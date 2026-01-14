type FaviconMeta = {
  iconUrl: string;
  updatedAt: number;
};

type IconFetchResult = {
  response: Response;
  metaUrl?: string;
};

function defaultIconSvg(hostname: string): string {
  const letter = hostname.trim().charAt(0).toUpperCase() || '•';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect x="4" y="4" width="56" height="56" rx="14" fill="#3b82f6"/>
  <text x="32" y="40" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-size="28" font-weight="800" fill="#ffffff">${letter}</text>
</svg>`;
}

function defaultIconResponse(hostname: string): Response {
  return new Response(defaultIconSvg(hostname), {
    status: 200,
    headers: {
      'content-type': 'image/svg+xml; charset=UTF-8',
    },
  });
}

function looksLikeCloudflareChallenge(resp: Response): boolean {
  if (resp.status !== 403) return false;
  const mitigated = resp.headers.get('cf-mitigated');
  if (mitigated && mitigated.toLowerCase().includes('challenge')) return true;
  const server = resp.headers.get('server') ?? '';
  return server.toLowerCase().includes('cloudflare');
}

function isImageResponse(resp: Response): boolean {
  const type = resp.headers.get('content-type') ?? '';
  return type.startsWith('image/') || type.includes('svg');
}

async function tryFetchImage(url: string, timeoutMs: number): Promise<Response | null> {
  try {
    const resp = await fetchWithTimeout(url, timeoutMs);
    if (!resp.ok) return null;
    if (!isImageResponse(resp)) return null;

    const lengthHeader = resp.headers.get('content-length');
    if (lengthHeader) {
      const length = Number(lengthHeader);
      if (!Number.isNaN(length) && length > 500_000) return null;
    }

    return resp;
  } catch {
    return null;
  }
}

type Env = {
  FAVICON_KV?: KVNamespace;
  API_KEY?: string;
};

function isIpv4(hostname: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
}

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;

  return false;
}

function isSafeHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (!h) return false;
  if (h === 'localhost') return false;
  if (h.endsWith('.local')) return false;
  if (h.includes(':')) return false;
  if (isIpv4(h)) return !isPrivateIpv4(h);

  return /^([a-z0-9-]+\.)+[a-z]{2,}$/.test(h);
}

function buildCacheKey(origin: string): Request {
  return new Request(`https://favicon.du.dev/cache?origin=${encodeURIComponent(origin)}`);
}

function withCommonHeaders(resp: Response): Response {
  const headers = new Headers(resp.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=604800');
  return new Response(resp.body, { status: resp.status, headers });
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; favicon.du.dev/1.0)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function parseIconHrefFromHtml(html: string): string | null {
  const links = html.match(/<link[^>]+>/gi);
  if (!links) return null;

  for (const tag of links) {
    const relMatch = tag.match(/\brel\s*=\s*["']([^"']+)["']/i);
    if (!relMatch) continue;

    const rel = relMatch[1].toLowerCase();
    if (!rel.includes('icon')) continue;

    const hrefMatch = tag.match(/\bhref\s*=\s*["']([^"']+)["']/i);
    if (!hrefMatch) continue;

    return hrefMatch[1];
  }

  return null;
}

async function discoverFaviconUrl(origin: string): Promise<string> {
  const originUrl = new URL(origin);
  const faviconIco = new URL('/favicon.ico', originUrl).toString();

  try {
    const icoResp = await fetchWithTimeout(faviconIco, 8000);
    if (icoResp.ok && !looksLikeCloudflareChallenge(icoResp)) return faviconIco;
  } catch {
    return faviconIco;
  }

  let htmlResp: Response;
  try {
    htmlResp = await fetchWithTimeout(originUrl.toString(), 9000);
  } catch {
    return faviconIco;
  }

  if (!htmlResp.ok) return faviconIco;
  if (looksLikeCloudflareChallenge(htmlResp)) return faviconIco;

  const html = await htmlResp.text();
  const href = parseIconHrefFromHtml(html);
  if (!href) return faviconIco;

  try {
    return new URL(href, originUrl).toString();
  } catch {
    return faviconIco;
  }
}

async function getMeta(env: Env, key: string): Promise<FaviconMeta | null> {
  if (!env.FAVICON_KV) return null;
  const raw = await env.FAVICON_KV.get(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const p = parsed as { iconUrl?: unknown; updatedAt?: unknown };
    if (typeof p.iconUrl !== 'string' || typeof p.updatedAt !== 'number') return null;
    return { iconUrl: p.iconUrl, updatedAt: p.updatedAt };
  } catch {
    return null;
  }
}

async function putMeta(env: Env, key: string, meta: FaviconMeta): Promise<void> {
  if (!env.FAVICON_KV) return;
  await env.FAVICON_KV.put(key, JSON.stringify(meta), { expirationTtl: 86400 });
}

async function deleteMeta(env: Env, key: string): Promise<void> {
  if (!env.FAVICON_KV) return;
  await env.FAVICON_KV.delete(key);
}

function requireApiKey(env: Env, req: Request): boolean {
  const expected = env.API_KEY;
  if (!expected) return true;
  const provided = req.headers.get('x-api-key');
  return provided === expected;
}

async function fetchFavicon(site: URL, origin: string): Promise<IconFetchResult> {
  const discoveredUrl = await discoverFaviconUrl(origin);

  const direct = await tryFetchImage(discoveredUrl, 9000);
  if (direct) return { response: direct, metaUrl: discoveredUrl };

  const host = site.hostname;
  const ddgUrl = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
  const ddg = await tryFetchImage(ddgUrl, 8000);
  if (ddg) return { response: ddg, metaUrl: ddgUrl };

  const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  const google = await tryFetchImage(googleUrl, 8000);
  if (google) return { response: google, metaUrl: googleUrl };

  return { response: defaultIconResponse(host) };
}

async function handleIco(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const rawUrl = url.searchParams.get('url');
  const rawDomain = url.searchParams.get('domain');

  let site: URL;
  try {
    if (rawUrl) {
      site = new URL(rawUrl);
    } else if (rawDomain) {
      site = new URL(`https://${rawDomain}`);
    } else {
      return new Response('Missing url', { status: 400 });
    }
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  if (site.protocol !== 'http:' && site.protocol !== 'https:') return new Response('Invalid protocol', { status: 400 });
  if (!isSafeHostname(site.hostname)) return new Response('Invalid hostname', { status: 400 });

  const origin = site.origin;
  const metaKey = `meta:${origin}`;
  const cacheKey = buildCacheKey(origin);

  const cached = await caches.default.match(cacheKey);
  if (cached) return withCommonHeaders(cached);

  const meta = await getMeta(env, metaKey);
  const cachedUrl = meta?.iconUrl;

  if (cachedUrl) {
    const cachedResp = await tryFetchImage(cachedUrl, 9000);
    if (cachedResp) {
      const normalized = withCommonHeaders(cachedResp);
      ctx.waitUntil(caches.default.put(cacheKey, normalized.clone()));
      return normalized;
    }
  }

  const fetched = await fetchFavicon(site, origin);

  if (fetched.metaUrl) {
    ctx.waitUntil(putMeta(env, metaKey, { iconUrl: fetched.metaUrl, updatedAt: Date.now() }));
  }

  const normalized = withCommonHeaders(fetched.response);
  ctx.waitUntil(caches.default.put(cacheKey, normalized.clone()));
  return normalized;
}

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  if (!requireApiKey(env, request)) return new Response('Unauthorized', { status: 401 });

  const url = new URL(request.url);
  const rawUrl = url.searchParams.get('url');
  const rawDomain = url.searchParams.get('domain');

  let site: URL;
  try {
    if (rawUrl) {
      site = new URL(rawUrl);
    } else if (rawDomain) {
      site = new URL(`https://${rawDomain}`);
    } else {
      return new Response('Missing url', { status: 400 });
    }
  } catch {
    return new Response('Invalid url', { status: 400 });
  }

  if (!isSafeHostname(site.hostname)) return new Response('Invalid hostname', { status: 400 });

  const origin = site.origin;
  const metaKey = `meta:${origin}`;
  await deleteMeta(env, metaKey);
  await caches.default.delete(buildCacheKey(origin));

  return new Response('OK', { status: 200 });
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') return new Response('OK', { status: 200 });

    if (url.pathname === '/ico' && request.method === 'GET') {
      return handleIco(request, env, ctx);
    }

    if (url.pathname === '/refresh' && request.method === 'POST') {
      return handleRefresh(request, env);
    }

    return new Response('Not found', { status: 404 });
  },
};
