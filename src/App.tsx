import { useMemo, useState } from 'react';
import './App.css';

import { getLinkIconUrl } from './lib/favicon';
import { loadNavConfig } from './lib/navState';
import type { NavCategory, NavConfig, NavLink, ThemeMode } from './lib/navTypes';
import { isNavConfig } from './lib/navValidate';
import { createNavFuseIndex, indexNavLinks, searchNav } from './lib/search';
import { clearNavOverride, saveNavOverride } from './lib/storage';
import { useScrollProgress, scrollToTop } from './lib/useScrollProgress';
import { useThemeMode } from './lib/useThemeMode';
import { parseNavConfigFromYaml, sortCategories } from './lib/navLoad';

type ModalName = 'none' | 'add' | 'edit' | 'import' | 'export';

function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function slugifyId(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (base) return base;
  return `item-${Date.now().toString(36)}`;
}

function Modal(props: { title: string; onClose: () => void; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" onMouseDown={props.onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{props.title}</h3>
          <button className="icon-btn" onClick={props.onClose} aria-label="关闭">
            关闭
          </button>
        </div>
        <div className="modal-body">{props.children}</div>
        {props.actions ? <div className="modal-actions">{props.actions}</div> : null}
      </div>
    </div>
  );
}

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

function buildExportJson(config: NavConfig): string {
  return JSON.stringify(config, null, 2);
}

function parseImportText(text: string): NavConfig {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Empty input');

  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isNavConfig(parsed)) throw new Error('Invalid JSON config');
    return sortCategories(parsed);
  }

  const parsed = parseNavConfigFromYaml(trimmed) as unknown;
  if (!isNavConfig(parsed)) throw new Error('Invalid YAML config');
  return sortCategories(parsed);
}

function findCategory(config: NavConfig, categoryId: string): NavCategory | undefined {
  return config.categories.find((c) => c.id === categoryId);
}

function upsertLink(config: NavConfig, categoryId: string, link: NavLink): NavConfig {
  const categories = config.categories.map((c) => {
    if (c.id !== categoryId) return c;
    const existingIndex = c.items.findIndex((i) => i.id === link.id);
    const nextItems = [...c.items];
    if (existingIndex >= 0) nextItems[existingIndex] = link;
    else nextItems.push(link);
    return { ...c, items: nextItems };
  });

  return { ...config, categories };
}

function removeLink(config: NavConfig, categoryId: string, linkId: string): NavConfig {
  return {
    ...config,
    categories: config.categories.map((c) => {
      if (c.id !== categoryId) return c;
      return { ...c, items: c.items.filter((i) => i.id !== linkId) };
    }),
  };
}

function moveOrUpdateLink(
  config: NavConfig,
  fromCategoryId: string,
  toCategoryId: string,
  link: NavLink,
): NavConfig {
  const removed = removeLink(config, fromCategoryId, link.id);
  return upsertLink(removed, toCategoryId, link);
}

export default function App() {
  const [config, setConfig] = useState<NavConfig>(() => loadNavConfig());

  const defaultTheme = (config.site.defaultTheme ?? 'system') as ThemeMode;
  const { resolved, toggleLightDark } = useThemeMode(defaultTheme);

  const [activeCategoryId, setActiveCategoryId] = useState(() => config.categories[0]?.id ?? '');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const effectiveActiveCategoryId = useMemo(() => {
    if (config.categories.some((c) => c.id === activeCategoryId)) return activeCategoryId;
    return config.categories[0]?.id ?? '';
  }, [activeCategoryId, config.categories]);

  const activeCategory = useMemo(
    () => findCategory(config, effectiveActiveCategoryId),
    [config, effectiveActiveCategoryId],
  );

  const [query, setQuery] = useState('');
  const indexedLinks = useMemo(() => indexNavLinks(config), [config]);
  const fuse = useMemo(() => createNavFuseIndex(indexedLinks), [indexedLinks]);
  const searchResults = useMemo(() => searchNav(fuse, query), [fuse, query]);

  const gridLinks = useMemo(() => {
    const q = query.trim();
    if (q) return searchResults.map((r) => r.link);
    return indexedLinks.filter((l) => l.categoryId === effectiveActiveCategoryId);
  }, [effectiveActiveCategoryId, indexedLinks, query, searchResults]);

  const title = config.site.title || 'nav.du.dev';
  const subtitle = config.site.description || '';

  const [modal, setModal] = useState<ModalName>('none');

  const [addCategoryId, setAddCategoryId] = useState(() => config.categories[0]?.id ?? '');
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [addDesc, setAddDesc] = useState('');
  const [addTags, setAddTags] = useState('');

  const effectiveAddCategoryId = useMemo(() => {
    if (config.categories.some((c) => c.id === addCategoryId)) return addCategoryId;
    return config.categories[0]?.id ?? '';
  }, [addCategoryId, config.categories]);

  const [editOriginalCategoryId, setEditOriginalCategoryId] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTags, setEditTags] = useState('');

  const effectiveEditCategoryId = useMemo(() => {
    if (config.categories.some((c) => c.id === editCategoryId)) return editCategoryId;
    return config.categories[0]?.id ?? '';
  }, [editCategoryId, config.categories]);

  const openEdit = (categoryId: string, link: NavLink) => {
    setEditOriginalCategoryId(categoryId);
    setEditCategoryId(categoryId);
    setEditId(link.id);
    setEditName(link.name);
    setEditUrl(link.url);
    setEditDesc(link.desc ?? '');
    setEditTags((link.tags ?? []).join(', '));
    setModal('edit');
  };

  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const exportJson = useMemo(() => buildExportJson(config), [config]);

  const progress = useScrollProgress();
  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringCircumference * (1 - progress);

  const onSaveConfig = (next: NavConfig) => {
    setConfig(next);
    saveNavOverride(next);
  };

  const onAddSubmit = () => {
    const name = addName.trim();
    const url = normalizeUrl(addUrl);
    const desc = addDesc.trim();

    if (!name || !url) return;

    const tags = addTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const link: NavLink = {
      id: slugifyId(name),
      name,
      url,
      desc: desc || undefined,
      tags: tags.length ? tags : undefined,
    };

    const next = upsertLink(config, effectiveAddCategoryId, link);
    onSaveConfig(next);

    setAddName('');
    setAddUrl('');
    setAddDesc('');
    setAddTags('');
    setModal('none');
  };

  const onEditSubmit = () => {
    const name = editName.trim();
    const url = normalizeUrl(editUrl);
    const desc = editDesc.trim();

    if (!editId || !name || !url) return;

    const tags = editTags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const link: NavLink = {
      id: editId,
      name,
      url,
      desc: desc || undefined,
      tags: tags.length ? tags : undefined,
    };

    const fromCategory = editOriginalCategoryId || effectiveEditCategoryId;
    const toCategory = effectiveEditCategoryId;

    const next = moveOrUpdateLink(config, fromCategory, toCategory, link);
    onSaveConfig(next);

    setModal('none');
  };

  const onEditDelete = () => {
    if (!editId) return;
    const fromCategory = editOriginalCategoryId || effectiveEditCategoryId;
    const next = removeLink(config, fromCategory, editId);
    onSaveConfig(next);
    setModal('none');
  };

  const onImportApply = () => {
    setImportError('');
    try {
      const parsed = parseImportText(importText);
      onSaveConfig(parsed);
      setModal('none');
      setImportText('');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed';
      setImportError(message);
    }
  };

  const onResetConfig = () => {
    clearNavOverride();
    const next = loadNavConfig();
    setConfig(next);
    setActiveCategoryId(next.categories[0]?.id ?? '');
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
  };

  return (
    <div className="app-shell">
      {sidebarOpen ? <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} /> : null}

      <aside className={`sidebar ${sidebarOpen ? 'is-open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-title">{title}</div>
            {subtitle ? <div className="sidebar-subtitle">{subtitle}</div> : null}
          </div>
        </div>

        <div className="sidebar-list">
          {config.categories.map((c) => (
            <button
              key={c.id}
              className={`sidebar-item ${c.id === effectiveActiveCategoryId ? 'is-active' : ''}`}
              onClick={() => {
                setActiveCategoryId(c.id);
                setSidebarOpen(false);
              }}
            >
              <span>{c.name}</span>
              <span className="sidebar-item-count">{c.items.length}</span>
            </button>
          ))}
        </div>
      </aside>

      <main className="main">
        <header className="banner">
          <div className="banner-row">
            <div className="mobile-topbar">
              <button className="mobile-menu-btn" onClick={() => setSidebarOpen(true)} aria-label="打开菜单">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
              <div>
                <div className="banner-title">{activeCategory?.name ?? title}</div>
              </div>
            </div>

            <h1 className="banner-title">{activeCategory?.name ?? title}</h1>

            <div className="banner-tools">
              <button className="icon-btn" onClick={() => setModal('add')}>
                添加
              </button>
              <button className="icon-btn" onClick={() => setModal('import')}>
                导入
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  setModal('export');
                }}
              >
                导出
              </button>
              <button className="icon-btn" onClick={onResetConfig}>
                重置
              </button>
            </div>
          </div>

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
        </header>

        <section className="content">
          <div className="section-title">
            <h2>{query.trim() ? '搜索结果' : activeCategory?.name ?? '链接'}</h2>
            <span>{gridLinks.length} 项</span>
          </div>

          <div className="grid">
            {gridLinks.map((link) => {
              const categoryId = link.categoryId;

              return (
                <a
                  key={`${categoryId}:${link.id}`}
                  className="card"
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => {
                    if (!e.shiftKey) return;
                    e.preventDefault();
                    openEdit(categoryId, link);
                  }}
                >
                  <div className="card-icon">
                    <img src={getLinkIconUrl(link)} alt="" loading="lazy" />
                  </div>
                  <div className="card-body">
                    <p className="card-title">{link.name}</p>
                    <p className="card-desc">{link.desc ?? link.url}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <div className="fab">
          <button className="fab-btn" onClick={toggleLightDark} aria-label="切换主题">
            {resolved === 'dark' ? <IconSun /> : <IconMoon />}
          </button>

          <button className="fab-btn" onClick={scrollToTop} aria-label="返回顶部">
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
            <IconArrowUp />
          </button>
        </div>
      </main>

      {modal === 'add' ? (
        <Modal
          title="添加网站"
          onClose={() => setModal('none')}
          actions={
            <>
              <button className="btn" onClick={() => setModal('none')}>
                取消
              </button>
              <button className="btn btn-primary" onClick={onAddSubmit} disabled={!addName.trim() || !addUrl.trim()}>
                保存
              </button>
            </>
          }
        >
          <div className="form-row">
            <label>分类</label>
            <select value={effectiveAddCategoryId} onChange={(e) => setAddCategoryId(e.target.value)}>
              {config.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>网站名称</label>
            <input value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="例如：GitHub" />
          </div>

          <div className="form-row">
            <label>网址</label>
            <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="例如：https://github.com" />
          </div>

          <div className="form-row">
            <label>说明（可选）</label>
            <input value={addDesc} onChange={(e) => setAddDesc(e.target.value)} placeholder="一句话描述" />
          </div>

          <div className="form-row">
            <label>标签（可选，逗号分隔）</label>
            <input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="code, git" />
          </div>
        </Modal>
      ) : null}

      {modal === 'edit' ? (
        <Modal
          title="编辑网站（Shift + 点击卡片）"
          onClose={() => setModal('none')}
          actions={
            <>
              <button className="btn" onClick={onEditDelete} disabled={!editId}>
                删除
              </button>
              <button className="btn" onClick={() => setModal('none')}>
                取消
              </button>
              <button className="btn btn-primary" onClick={onEditSubmit} disabled={!editName.trim() || !editUrl.trim()}>
                保存
              </button>
            </>
          }
        >
          <div className="form-row">
            <label>分类</label>
            <select value={effectiveEditCategoryId} onChange={(e) => setEditCategoryId(e.target.value)}>
              {config.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>网站名称</label>
            <input value={editName} onChange={(e) => setEditName(e.target.value)} />
          </div>

          <div className="form-row">
            <label>网址</label>
            <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
          </div>

          <div className="form-row">
            <label>说明（可选）</label>
            <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
          </div>

          <div className="form-row">
            <label>标签（可选，逗号分隔）</label>
            <input value={editTags} onChange={(e) => setEditTags(e.target.value)} />
          </div>
        </Modal>
      ) : null}

      {modal === 'export' ? (
        <Modal
          title="导出配置（JSON）"
          onClose={() => setModal('none')}
          actions={
            <>
              <button className="btn" onClick={() => copyToClipboard(exportJson)}>
                复制
              </button>
              <button className="btn btn-primary" onClick={() => setModal('none')}>
                关闭
              </button>
            </>
          }
        >
          <div className="form-row">
            <label>复制后可保存到仓库或备份</label>
            <textarea value={exportJson} readOnly />
          </div>
        </Modal>
      ) : null}

      {modal === 'import' ? (
        <Modal
          title="导入配置（JSON 或 YAML）"
          onClose={() => setModal('none')}
          actions={
            <>
              <button className="btn" onClick={() => setModal('none')}>
                取消
              </button>
              <button className="btn btn-primary" onClick={onImportApply} disabled={!importText.trim()}>
                应用
              </button>
            </>
          }
        >
          <div className="form-row">
            <label>粘贴 JSON/YAML</label>
            <textarea value={importText} onChange={(e) => setImportText(e.target.value)} />
          </div>
          {importError ? <div style={{ color: 'var(--primary)', fontSize: 12 }}>{importError}</div> : null}
        </Modal>
      ) : null}
    </div>
  );
}
