import { useEffect, useMemo, useState } from 'react';

import type { ThemeMode } from './navTypes';
import { loadThemeMode, saveThemeMode } from './storage';
import { readSystemPrefersDark, resolveTheme, subscribeSystemThemeChange } from './theme';

function coerceThemeMode(value: string | null | undefined): ThemeMode {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}

export function useThemeMode(defaultTheme: ThemeMode): {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  toggleLightDark: () => void;
} {
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => readSystemPrefersDark());

  useEffect(() => subscribeSystemThemeChange(() => setSystemPrefersDark(readSystemPrefersDark())), []);

  const [mode, setModeState] = useState<ThemeMode>(() => {
    const stored = loadThemeMode();
    return stored === null ? defaultTheme : coerceThemeMode(stored);
  });

  const resolved = useMemo(() => resolveTheme(mode, systemPrefersDark), [mode, systemPrefersDark]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
  }, [resolved]);

  const setMode = (next: ThemeMode) => {
    setModeState(next);
    saveThemeMode(next);
  };

  const toggleLightDark = () => {
    const next = resolved === 'dark' ? 'light' : 'dark';
    setMode(next);
  };

  return { mode, resolved, setMode, toggleLightDark };
}
