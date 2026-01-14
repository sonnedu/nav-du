const NAV_STORAGE_KEY = 'nav.du.dev/nav-config-override';
const THEME_STORAGE_KEY = 'nav.du.dev/theme-mode';

export function loadNavOverride(): unknown | null {
  try {
    const raw = localStorage.getItem(NAV_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

export function saveNavOverride(value: unknown): void {
  localStorage.setItem(NAV_STORAGE_KEY, JSON.stringify(value));
}

export function clearNavOverride(): void {
  localStorage.removeItem(NAV_STORAGE_KEY);
}

export function loadThemeMode(): string | null {
  return localStorage.getItem(THEME_STORAGE_KEY);
}

export function saveThemeMode(value: string): void {
  localStorage.setItem(THEME_STORAGE_KEY, value);
}
