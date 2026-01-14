import { useEffect, useMemo, useRef, useState } from 'react';

import { applyDefaultIconOnError, getLinkIconUrl } from '../lib/favicon';
import type { IndexedNavLink, NavCategory, NavConfig } from '../lib/navTypes';

const DEFAULT_CATEGORY_ICONS: Record<string, string> = {
  dev: '💻',
  ai: '🤖',
  tools: '🧰',
  docs: '📚',
  search: '🔎',
  productivity: '✅',
  design: '🎨',
  cloud: '☁️',
  devops: '⚙️',
  news: '📰',
  video: '🎬',
  shopping: '🛒',
  finance: '💰',
  misc: '📌',
};

function getCategoryIcon(category: NavCategory): string {
  return category.icon || DEFAULT_CATEGORY_ICONS[category.id] || '📌';
}

import { createNavFuseIndex, indexNavLinks, searchNav } from '../lib/search';
import { useScrollProgress, scrollToTop } from '../lib/useScrollProgress';

function IconSearch() {
  return (
    <svg className="search-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M21 14.2a8.2 8.2 0 0 1-10.2-10 9 9 0 1 0 10.2 10Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconArrowUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 5l-6 6M12 5l6 6M12 5v14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconHamburger() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconPanelLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 5h16v14H4z" stroke="currentColor" strokeWidth="2" />
      <path d="M9 5v14" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function sectionId(categoryId: string): string {
  return `cat-${categoryId}`;
}


function useActiveCategoryObserver(categories: NavCategory[], onActive: (categoryId: string) => void): void {
  const onActiveRef = useRef(onActive);

  useEffect(() => {
    onActiveRef.current = onActive;
  }, [onActive]);

  useEffect(() => {
    const elements = categories
      .map((c) => document.getElementById(sectionId(c.id)))
      .filter((el): el is HTMLElement => !!el);

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => (a.boundingClientRect.top ?? 0) - (b.boundingClientRect.top ?? 0));

        const first = visible[0];
        const id = first?.target?.id;
        if (!id) return;

        const categoryId = id.replace(/^cat-/, '');
        if (categoryId) onActiveRef.current(categoryId);
      },
      {
        root: null,
        threshold: 0.2,
        rootMargin: '-10% 0px -70% 0px',
      },
    );

    for (const el of elements) observer.observe(el);

    return () => observer.disconnect();
  }, [categories]);
}

export function NavPage(props: {
  config: NavConfig;
  sidebarTitle: string;
  sidebarAvatarSrc: string;
  bannerTitle: string;
  subtitle: string;
  timeZone: string;
  faviconProxyBase: string;
  resolvedTheme: 'light' | 'dark';
  onToggleTheme: () => void;
}) {
  const { config } = props;

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState(() => config.categories[0]?.id ?? '');

  useActiveCategoryObserver(config.categories, (categoryId) => {
    setActiveCategoryId(categoryId);
  });

  const [query, setQuery] = useState('');
  const indexedLinks = useMemo(() => indexNavLinks(config), [config]);
  const fuse = useMemo(() => createNavFuseIndex(indexedLinks), [indexedLinks]);
  const searchResults = useMemo(() => searchNav(fuse, query), [fuse, query]);

  const content = useMemo(() => {
    const q = query.trim();
    if (!q) return null;
    return searchResults.map((r) => r.link);
  }, [query, searchResults]);

  const progress = useScrollProgress();
  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progress);

  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const dateText = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: props.timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
  }, [now, props.timeZone]);

  const timeText = useMemo(() => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: props.timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(now);
  }, [now, props.timeZone]);

  return (
    <div className={`app-shell app-shell--with-sidebar ${sidebarHidden ? 'app-shell--sidebar-hidden' : ''}`}>
      {sidebarOpen ? <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} /> : null}

      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          {props.sidebarAvatarSrc ? (
            <img className="sidebar-avatar" src={props.sidebarAvatarSrc} alt="avatar" loading="lazy" />
          ) : null}

          <div className="sidebar-brand">
            <div className="sidebar-title">{props.sidebarTitle}</div>
            {props.subtitle ? <div className="sidebar-subtitle">{props.subtitle}</div> : null}
          </div>
        </div>

        <div className="sidebar-list">
          {config.categories.map((c) => (
            <button
              key={c.id}
              className={`sidebar-item ${c.id === activeCategoryId ? 'is-active' : ''}`}
              onClick={() => {
                setActiveCategoryId(c.id);
                document.getElementById(sectionId(c.id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                setSidebarOpen(false);
              }}
              title={c.name}
            >
              <span className="category-icon" aria-hidden="true">{getCategoryIcon(c)}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">© 2026 du.dev</div>
      </aside>


      <main className="main">
        <header className="banner">
          <div className="banner-row">
            <div className="banner-left">
              <div className="mobile-topbar">
                <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="打开菜单">
                  <IconHamburger />
                </button>
                <div>
                  <div className="banner-title">👋 {props.bannerTitle}</div>
                </div>
              </div>

              <h1 className="banner-title">👋 {props.bannerTitle}</h1>

              <div className="search">
                <IconSearch />
                <input
                  className="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索名称 / 网址 / 描述（支持拼音与缩写）"
                  inputMode="search"
                />
              </div>
            </div>

            <div className="banner-tools">
              <div className="banner-time" aria-label="当前时间">
                <div className="banner-time-main">{timeText}</div>
                <div className="banner-time-sub">{dateText}</div>
              </div>
            </div>
          </div>
        </header>

        <section className="content">
          {content ? (
            <>
              <div className="section-title">
                <h2>搜索结果</h2>
              </div>

              <div className="grid">
                {content.map((link: IndexedNavLink) => (
                  <a key={`${link.categoryId}:${link.id}`} className="card" href={link.url} target="_blank" rel="noreferrer">
                    <div className="card-icon">
                      <img
                        src={getLinkIconUrl(link, props.faviconProxyBase)}
                        alt=""
                        loading="lazy"
                        onError={(e) => applyDefaultIconOnError(e.currentTarget)}
                      />
                    </div>
                    <div className="card-body">
                      <p className="card-title">{link.name}</p>
                      <p className="card-desc">{link.desc ?? link.url}</p>
                    </div>
                  </a>
                ))}
              </div>
            </>
          ) : (
            config.categories.map((category) => (
              <div key={category.id} id={sectionId(category.id)} className="section-block" style={{ scrollMarginTop: 12 }}>
                <div className="section-title">
                  <h2>
                    <span className="category-icon" aria-hidden="true">{getCategoryIcon(category)}</span>
                    {category.name}
                  </h2>
                </div>
                <div className="grid">
                  {category.items.map((link) => (
                    <a
                      key={`${category.id}:${link.id}`}
                      className="card"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <div className="card-icon">
                        <img
                          src={getLinkIconUrl(link, props.faviconProxyBase)}
                          alt=""
                          loading="lazy"
                          onError={(e) => applyDefaultIconOnError(e.currentTarget)}
                        />
                      </div>
                      <div className="card-body">
                        <p className="card-title">{link.name}</p>
                        <p className="card-desc">{link.desc ?? link.url}</p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>

        <div className="fab">
          <button
            className="fab-btn"
            onClick={() => {
              setSidebarHidden((v) => !v);
              setSidebarOpen(false);
            }}
            aria-label="切换侧栏"
            title={sidebarHidden ? '显示侧栏' : '隐藏侧栏'}
          >
            <IconPanelLeft />
          </button>

          <button className="fab-btn" onClick={props.onToggleTheme} aria-label="切换主题">
            {props.resolvedTheme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>

          <div className="fab-btn-wrap">
            <svg className="fab-progress" viewBox="0 0 48 48" aria-hidden="true">
              <circle
                cx="24"
                cy="24"
                r={ringRadius}
                fill="none"
                stroke="color-mix(in srgb, var(--border) 85%, transparent)"
                strokeWidth="3"
              />
              <circle
                cx="24"
                cy="24"
                r={ringRadius}
                fill="none"
                stroke="var(--primary)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 24 24)"
              />
            </svg>

            <button className="fab-btn" onClick={scrollToTop} aria-label="返回顶部" title="返回顶部">
              <IconArrowUp />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
