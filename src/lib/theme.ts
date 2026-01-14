import type { ThemeMode } from './navTypes';

export type ResolvedTheme = 'light' | 'dark';

export function resolveTheme(mode: ThemeMode, systemPrefersDark: boolean): ResolvedTheme {
  if (mode === 'system') return systemPrefersDark ? 'dark' : 'light';
  return mode;
}

export function readSystemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function subscribeSystemThemeChange(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => onChange();

  mediaQuery.addEventListener('change', handler);

  const legacy = mediaQuery as MediaQueryList & {
    addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
    removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
  };

  if (typeof legacy.addListener === 'function' && typeof legacy.removeListener === 'function') {
    legacy.addListener(handler);
    return () => {
      mediaQuery.removeEventListener('change', handler);
      legacy.removeListener?.(handler);
    };
  }

  return () => mediaQuery.removeEventListener('change', handler);
}
