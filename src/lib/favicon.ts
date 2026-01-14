import type { IconConfig, NavLink } from './navTypes';

const DEFAULT_FAVICON_PROXY = 'https://favicon.du.dev/ico';

export function getLinkIconUrl(link: NavLink, faviconProxyBaseUrl = DEFAULT_FAVICON_PROXY): string {
  const icon = link.icon;

  if (!icon || icon.type === 'proxy') {
    const encoded = encodeURIComponent(link.url);
    return `${faviconProxyBaseUrl}?url=${encoded}`;
  }

  if (icon.type === 'url') return icon.value;
  if (icon.type === 'base64') return icon.value;

  return `${faviconProxyBaseUrl}?url=${encodeURIComponent(link.url)}`;
}

export function normalizeIconConfig(input: unknown): IconConfig | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const candidate = input as { type?: unknown; value?: unknown };
  if (candidate.type === 'proxy') return { type: 'proxy' };
  if (candidate.type === 'url' && typeof candidate.value === 'string') return { type: 'url', value: candidate.value };
  if (candidate.type === 'base64' && typeof candidate.value === 'string') return { type: 'base64', value: candidate.value };
  return undefined;
}
