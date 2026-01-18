import './App.css';

import { Suspense, lazy, useMemo } from 'react';

import { useI18n } from './lib/useI18n';

import type { NavConfig, ThemeMode } from './lib/navTypes';
import { usePathname } from './lib/usePathname';
import { useNavConfig } from './lib/useNavConfig';
import { useThemeMode } from './lib/useThemeMode';
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));
import { NavPage } from './pages/NavPage';

function normalizePathPrefix(input: string): string {
  const raw = input.trim();
  if (!raw) return '/admin';
  const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
  const noQuery = withSlash.split('?')[0]?.split('#')[0] ?? withSlash;
  const normalized = noQuery.replace(/\/+$/g, '');
  return normalized || '/admin';
}

function isAdminPath(pathname: string, adminPathPrefix: string): boolean {
  if (pathname === adminPathPrefix) return true;
  return pathname.startsWith(`${adminPathPrefix}/`);
}

function coerceEnvString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export default function App() {
  const { config, resetRemoteToBase, saveConfigRemote, reloadRemote } = useNavConfig();
  const { m } = useI18n();

  const defaultTheme = (config.site.defaultTheme ?? 'system') as ThemeMode;
  const { resolved, toggleLightDark } = useThemeMode(defaultTheme);

  const pathname = usePathname();

  const adminPathPrefix = useMemo(() => {
    const envPath = coerceEnvString(import.meta.env.VITE_ADMIN_PATH);
    return normalizePathPrefix(envPath || config.site.adminPath || '/admin');
  }, [config.site.adminPath]);

  const admin = useMemo(() => isAdminPath(pathname, adminPathPrefix), [pathname, adminPathPrefix]);

  const title = config.site.title || 'Nav-Du';
  const subtitle = config.site.description || '';

  const sidebarAvatarSrc = (coerceEnvString(import.meta.env.VITE_SIDEBAR_AVATAR_SRC) || config.site.sidebarAvatarSrc || '').trim();

  const sidebarTitle = (coerceEnvString(import.meta.env.VITE_SIDEBAR_TITLE) || config.site.sidebarTitle || 'Nav-Du').trim();
  const bannerTitle = (coerceEnvString(import.meta.env.VITE_BANNER_TITLE) || config.site.bannerTitle || m.app.bannerTitleDefault).trim();
  const timeZone = (coerceEnvString(import.meta.env.VITE_TIME_ZONE) || config.site.timeZone || 'Asia/Shanghai').trim();
  const faviconProxyBase = (coerceEnvString(import.meta.env.VITE_FAVICON_PROXY_BASE) || config.site.faviconProxyBase || '').trim();

  const onSaveConfig = async (next: NavConfig) => {
    return await saveConfigRemote(next);
  };

  const onResetConfig = async () => {
    const ok = await resetRemoteToBase();
    await reloadRemote();
    return ok;
  };

  if (admin) {
    return (
      <Suspense fallback={null}>
        <AdminPage
          config={config}
          title={title}
          onSaveConfig={onSaveConfig}
          onResetConfig={onResetConfig}
          onReload={reloadRemote}
        />
      </Suspense>
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
