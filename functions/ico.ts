// Favicon proxy with origin-based access control
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
  NAV_CONFIG_KV?: KVNamespace;
  FAVICON_KV?: KVNamespace;
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
  return new Request(`https://favicon-proxy.invalid/cache?origin=${encodeURIComponent(origin)}`);
}

function withCommonHeaders(resp: Response): Response {
  const newHeaders = new Headers(resp.headers);
  newHeaders.set('Access-Control-Allow-Origin', '*');
  newHeaders.set('Cache-Control', 'public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400');

  return new Response(resp.body, {
    status: resp.status,
    headers: newHeaders,
  });
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; nav-du/1.0)',
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
  const kv = env.FAVICON_KV || env.NAV_CONFIG_KV;
  if (!kv) return null;
  const raw = await kv.get(key);
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
  const kv = env.FAVICON_KV || env.NAV_CONFIG_KV;
  if (!kv) return;
  await kv.put(key, JSON.stringify(meta), { expirationTtl: 604800 });
}



async function fetchFavicon(site: URL, origin: string): Promise<IconFetchResult> {
  const host = site.hostname;

  const ddgUrl = `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`;
  const ddg = await tryFetchImage(ddgUrl, 7000);
  if (ddg) return { response: ddg, metaUrl: ddgUrl };

  const googleUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  const google = await tryFetchImage(googleUrl, 7000);
  if (google) return { response: google, metaUrl: googleUrl };

  const discoveredUrl = await discoverFaviconUrl(origin);

  const direct = await tryFetchImage(discoveredUrl, 9000);
  if (direct) return { response: direct, metaUrl: discoveredUrl };

  return { response: defaultIconResponse(host) };
}

function isSameOrigin(request: Request, requestHostname: string): boolean {
  const origin = request.headers.get('origin');
  if (origin) {
    const originHostname = new URL(origin).hostname;
    return originHostname === requestHostname;
  }

  const referer = request.headers.get('referer');
  if (referer) {
    try {
      const refererHostname = new URL(referer).hostname;
      return refererHostname === requestHostname;
    } catch {
      return false;
    }
  }

  return false;
}

async function handleIco(request: Request, env: Env, waitUntil: (promise: Promise<unknown>) => void): Promise<Response> {
  const requestUrl = new URL(request.url);
  const requestHostname = requestUrl.hostname;

  if (!isSameOrigin(request, requestHostname)) {
    const debugOrigin = request.headers.get('origin');
    const debugReferer = request.headers.get('referer');
    return new Response(`Forbidden: hostname=${requestHostname}, origin=${debugOrigin}, referer=${debugReferer}`, { status: 403 });
  }

  const rawUrl = requestUrl.searchParams.get('url');
  const rawDomain = requestUrl.searchParams.get('domain');

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
      waitUntil(caches.default.put(cacheKey, normalized.clone()));
      return normalized;
    }
  }

  const fetched = await fetchFavicon(site, origin);

  if (fetched.metaUrl) {
    waitUntil(putMeta(env, metaKey, { iconUrl: fetched.metaUrl, updatedAt: Date.now() }));
  }

  const normalized = withCommonHeaders(fetched.response);
  waitUntil(caches.default.put(cacheKey, normalized.clone()));
  return normalized;
}

export async function onRequestGet(context: { request: Request; env: Env; waitUntil: (promise: Promise<unknown>) => void }) {
  const { request, env, waitUntil } = context;
  return handleIco(request, env, waitUntil);
}

