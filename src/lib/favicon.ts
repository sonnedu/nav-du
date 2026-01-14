import type { IconConfig, NavLink } from './navTypes';

const DEFAULT_FAVICON_PROXY = import.meta.env.VITE_FAVICON_PROXY_BASE ?? '';

export const DEFAULT_ICON_DATA_URI =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">' +
      '<rect x="4" y="4" width="56" height="56" rx="14" fill="#3b82f6"/>' +
      '<path fill="#ffffff" d="M32 16c-8.837 0-16 7.163-16 16s7.163 16 16 16 16-7.163 16-16-7.163-16-16-16Zm0 3c1.86 0 3.62.42 5.2 1.17-1.28.6-2.63 1.59-3.92 2.98-.94 1.01-1.75 2.21-2.38 3.57H25.1c-.63-1.36-1.44-2.56-2.38-3.57-1.29-1.39-2.64-2.38-3.92-2.98A12.93 12.93 0 0 1 32 19Zm-11.2 4.44c.93.48 2.1 1.28 3.16 2.41.43.46.83.99 1.18 1.57h-6.2c.4-1.46 1.05-2.8 1.86-3.98Zm22.4 0c.81 1.18 1.46 2.52 1.86 3.98h-6.2c.35-.58.75-1.11 1.18-1.57 1.06-1.13 2.23-1.93 3.16-2.41ZM18.37 30.4h7.93c-.2 1.02-.3 2.1-.3 3.2 0 1.1.1 2.18.3 3.2h-7.93a12.93 12.93 0 0 1 0-6.4Zm19.33 0h7.93c.28 1.03.43 2.09.43 3.2 0 1.11-.15 2.17-.43 3.2H37.7c.2-1.02.3-2.1.3-3.2 0-1.1-.1-2.18-.3-3.2Zm-8.4 0c.25 1.01.4 2.07.4 3.2 0 1.13-.15 2.19-.4 3.2h6.8c.22-1.02.33-2.09.33-3.2 0-1.11-.11-2.18-.33-3.2h-6.8Zm-3.2 0h-6.8c-.22 1.02-.33 2.09-.33 3.2 0 1.11.11 2.18.33 3.2h6.8c-.25-1.01-.4-2.07-.4-3.2 0-1.13.15-2.19.4-3.2Zm-5.3 9.78h6.2c-.35.58-.75 1.11-1.18 1.57-1.06 1.13-2.23 1.93-3.16 2.41a13.05 13.05 0 0 1-1.86-3.98Zm17 0h6.2c-.4 1.46-1.05 2.8-1.86 3.98-.93-.48-2.1-1.28-3.16-2.41-.43-.46-.83-.99-1.18-1.57ZM32 45c-1.86 0-3.62-.42-5.2-1.17 1.28-.6 2.63-1.59 3.92-2.98.94-1.01 1.75-2.21 2.38-3.57h5.78c.63 1.36 1.44 2.56 2.38 3.57 1.29 1.39 2.64 2.38 3.92 2.98A12.93 12.93 0 0 1 32 45Z"/>' +
      '</svg>',
  );

export function applyDefaultIconOnError(img: HTMLImageElement): void {
  if (img.src === DEFAULT_ICON_DATA_URI) return;
  img.src = DEFAULT_ICON_DATA_URI;
}

export function getLinkIconUrl(link: NavLink, faviconProxyBaseUrl = DEFAULT_FAVICON_PROXY): string {
  const icon = link.icon;

  if (!icon || icon.type === 'proxy') {
    if (faviconProxyBaseUrl) {
      const encoded = encodeURIComponent(link.url);
      return `${faviconProxyBaseUrl}?url=${encoded}`;
    }

    try {
      const host = new URL(link.url).hostname;
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
    } catch {
      return DEFAULT_ICON_DATA_URI;
    }
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
