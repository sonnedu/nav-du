const ERROR_HANDLER_ORIGIN = 'https://global-error-handler.beanbest.workers.dev';

function wantsHtmlNavigation(request: Request): boolean {
  if (request.method !== 'GET' && request.method !== 'HEAD') return false;

  const accept = request.headers.get('accept') || '';
  if (!accept.includes('text/html')) return false;

  const dest = (request.headers.get('sec-fetch-dest') || '').toLowerCase();
  if (dest && dest !== 'document') return false;

  return true;
}

function shouldBypass(request: Request): boolean {
  const url = new URL(request.url);

  // Never touch API routes (keep JSON errors as-is).
  if (url.pathname.startsWith('/api/')) return true;

  return false;
}

export async function onRequest(context: { request: Request; next: () => Promise<Response> }): Promise<Response> {
  const { request, next } = context;
  const response = await next();

  if (response.status < 400) return response;
  if (shouldBypass(request)) return response;
  if (!wantsHtmlNavigation(request)) return response;

  const status = response.status;
  const url = new URL(request.url);

  try {
    const errUrl = new URL(`/error/${status}`, ERROR_HANDLER_ORIGIN);
    const errResp = await fetch(errUrl.toString(), {
      headers: {
        'accept-language': request.headers.get('accept-language') || '',
        'x-forwarded-host': url.host,
      },
    });

    const headers = new Headers(errResp.headers);
    headers.set('cache-control', 'no-store');
    return new Response(errResp.body, { status, headers });
  } catch {
    return response;
  }
}
