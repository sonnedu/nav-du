import './App.css';

import { useMemo } from 'react';

import type { NavConfig, ThemeMode } from './lib/navTypes';
import { usePathname } from './lib/usePathname';
import { useNavConfig } from './lib/useNavConfig';
import { useThemeMode } from './lib/useThemeMode';
import { AdminPage } from './pages/AdminPage';
import { NavPage } from './pages/NavPage';

function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

function coerceEnvString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default function App() {
  const { config, resetRemoteToBase, saveConfigRemote, reloadRemote } = useNavConfig();

  const defaultTheme = (config.site.defaultTheme ?? 'system') as ThemeMode;
  const { resolved, toggleLightDark } = useThemeMode(defaultTheme);

  const pathname = usePathname();
  const admin = useMemo(() => isAdminPath(pathname), [pathname]);

  const title = config.site.title || 'nav.du.dev';
  const subtitle = config.site.description || '';

  const sidebarTitle = (coerceEnvString(import.meta.env.VITE_SIDEBAR_TITLE) || config.site.sidebarTitle || '我的收藏').trim();
  const bannerTitle = (coerceEnvString(import.meta.env.VITE_BANNER_TITLE) || config.site.bannerTitle || "sonnedu’s 收藏夹").trim();
  const timeZone = (coerceEnvString(import.meta.env.VITE_TIME_ZONE) || config.site.timeZone || 'Asia/Shanghai').trim();

  const onSaveConfig = async (next: NavConfig) => {
    const ok = await saveConfigRemote(next);
    await reloadRemote();
    return ok;
  };

  const onResetConfig = async () => {
    const ok = await resetRemoteToBase();
    await reloadRemote();
    return ok;
  };

  if (admin) {
    return (
      <AdminPage
        config={config}
        title={title}
        onSaveConfig={onSaveConfig}
        onResetConfig={onResetConfig}
      />
    );
  }

  return (
    <NavPage
      config={config}
      sidebarTitle={sidebarTitle}
      bannerTitle={bannerTitle}
      subtitle={subtitle}
      timeZone={timeZone}
      resolvedTheme={resolved}
      onToggleTheme={toggleLightDark}
    />
  );
}
