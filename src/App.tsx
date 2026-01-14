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

  const title = config.site.title || 'nav-du';
  const subtitle = config.site.description || '';

  const sidebarAvatarSrc = (coerceEnvString(import.meta.env.VITE_SIDEBAR_AVATAR_SRC) || config.site.sidebarAvatarSrc || '').trim();

  const sidebarTitle = (coerceEnvString(import.meta.env.VITE_SIDEBAR_TITLE) || config.site.sidebarTitle || 'Nav-Du').trim();
  const bannerTitle = (coerceEnvString(import.meta.env.VITE_BANNER_TITLE) || config.site.bannerTitle || '我的收藏夹').trim();
  const timeZone = (coerceEnvString(import.meta.env.VITE_TIME_ZONE) || config.site.timeZone || 'Asia/Shanghai').trim();
  const faviconProxyBase = (coerceEnvString(import.meta.env.VITE_FAVICON_PROXY_BASE) || config.site.faviconProxyBase || '').trim();

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
      sidebarAvatarSrc={sidebarAvatarSrc}
      bannerTitle={bannerTitle}
      subtitle={subtitle}
      timeZone={timeZone}
      faviconProxyBase={faviconProxyBase}
      resolvedTheme={resolved}
      onToggleTheme={toggleLightDark}
    />
  );
}
