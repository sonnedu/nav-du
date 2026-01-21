import { useMemo, useState, useEffect } from 'react';

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { getCategoryIcon } from '../../lib/navIcons';
import { useI18n } from '../../lib/useI18n';
import type { NavCategory, NavConfig, NavLink } from '../../lib/navTypes';
import {
  removeLinksFromCategory,
  moveLinksToCategory,
  reorderCategoriesByIds,
  reorderLinksInCategoryByIds,
  upsertLinkInCategory,
} from '../../lib/admin/navConfigOps';

import { AdminCombobox } from './AdminCombobox';
import { AdminDialog } from './AdminDialog';
import { CategoryPage } from './CategoryPage';
import { ImportExportPage } from './ImportExportPage';
import { LinkModal } from './LinkModal';
import './Admin.css';

interface AdminDashboardProps {
  config: NavConfig;
  onSaveConfig: (next: NavConfig) => Promise<boolean>;
  onResetConfig: () => Promise<boolean>;
  user: { username: string };
  onLogout: () => Promise<void>;
  saveError?: string;
  onClearSaveError: () => void;
  onReload: () => void;
}

type EditingLink = { categoryId: string; link: NavLink };
type AdminPageType = 'links' | 'categories' | 'import-export';
type DropIndicator = { domId: string; position: 'top' | 'bottom' } | null;

interface DialogState {
  isOpen: boolean;
  title: string;
  message: string | React.ReactNode;
  confirmLabel?: string;
  onConfirm?: () => void;
  variant?: 'danger' | 'primary';
  type?: 'confirm' | 'alert';
}

function SortableCategorySection(props: {
  category: NavCategory;
  domId: string;
  canDrag: boolean;
  addLabel: string;
  onAddLink: () => void;
  children: React.ReactNode;
  dropIndicator: 'top' | 'bottom' | null;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: props.category.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  const indicatorClass = props.dropIndicator ? `is-over-${props.dropIndicator}` : '';

  return (
    <section
      id={props.domId}
      ref={setNodeRef}
      className={`admin-category-section ${isDragging ? 'is-dragging' : ''} ${isOver && !isDragging ? 'is-over' : ''} ${indicatorClass}`}
      style={style}
    >
      <header className="admin-category-header">
        <div className="admin-category-info">
          <span
            ref={setActivatorNodeRef}
            className="drag-handle"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder category"
            title="Drag to reorder"
            aria-disabled={!props.canDrag}
          >
            <span className="drag-handle-dots" />
          </span>
          <span className="admin-category-icon">{getCategoryIcon(props.category)}</span>
          <h3 className="admin-category-name">{props.category.name}</h3>
          {props.category.group ? <span className="admin-category-group">{props.category.group}</span> : null}
        </div>
        <div className="admin-category-actions">
          <button className="btn btn-sm" onClick={props.onAddLink}>
            {props.addLabel}
          </button>
        </div>
      </header>
      {props.children}
    </section>
  );
}

function SortableLinkRow(props: {
  categoryId: string;
  link: NavLink;
  domId: string;
  selected: boolean;
  canDrag: boolean;
  editLabel: string;
  onToggleSelected: () => void;
  onEdit: () => void;
  dropIndicator: 'top' | 'bottom' | null;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: props.link.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : undefined,
  };

  const indicatorClass = props.dropIndicator ? `is-over-${props.dropIndicator}` : '';

  return (
    <div
      id={props.domId}
      ref={setNodeRef}
      className={`admin-link-row ${props.selected ? 'selected' : ''} ${isDragging ? 'is-dragging' : ''} ${isOver && !isDragging ? 'is-over' : ''} ${indicatorClass}`}
      style={style}
      aria-disabled={!props.canDrag}
    >
      <input type="checkbox" checked={props.selected} onChange={props.onToggleSelected} />
      <div className="admin-link-name min-w-0">
        <span
          ref={setActivatorNodeRef}
          className="drag-handle admin-link-icon-wrap"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder link"
          title="Drag to reorder"
          aria-disabled={!props.canDrag}
        >
          <span className="drag-handle-dots" />
        </span>
        <span className="text-ellipsis min-w-0">{props.link.name}</span>
      </div>
      <div className="admin-link-url">{props.link.url}</div>
      <div className="admin-link-meta">
        <div className="admin-link-url-mobile">{props.link.url}</div>
        {props.link.desc && <div className="admin-link-desc">{props.link.desc}</div>}
        {props.link.tags && props.link.tags.length > 0 && (
          <div className="admin-link-tags">
            {props.link.tags.map((tag) => (
              <span key={tag} className="admin-link-tag">
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="admin-link-actions">
        <button className="btn btn-sm" onClick={props.onEdit}>
          {props.editLabel}
        </button>
      </div>
    </div>
  );
}

export function AdminDashboard(props: AdminDashboardProps) {
  const { config } = props;
  const { m } = useI18n();

  const getPageFromUrl = (): AdminPageType => {
    const params = new URLSearchParams(window.location.search);
    const p = params.get('page');
    if (p === 'categories') return 'categories';
    if (p === 'import-export') return 'import-export';
    return 'links';
  };

  const goToPage = (next: AdminPageType) => {
    const performGoTo = () => {
      setActivePage(next);
      const url = new URL(window.location.href);
      url.searchParams.set('page', next);
      window.history.replaceState(null, '', url);
      setIsSidebarOpen(false);
    };

    if (activePage === 'categories' && isCategoriesDirty && next !== 'categories') {
      showConfirm(m.admin.categoriesAndGroups, m.admin.confirmLeaveUnsaved, performGoTo);
      return;
    }

    performGoTo();
  };

  const [activePage, setActivePage] = useState<AdminPageType>(() => getPageFromUrl());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCategoriesDirty, setIsCategoriesDirty] = useState(false);

  const [dialog, setDialog] = useState<DialogState>({
    isOpen: false,
    title: '',
    message: '',
  });

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));
  const showConfirm = (title: string, message: string, onConfirm: () => void, variant: 'danger' | 'primary' = 'primary') => 
    setDialog({ isOpen: true, title, message, onConfirm, variant, type: 'confirm' });

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLinks, setSelectedLinks] = useState<Record<string, string[]>>({});
  const [dropIndicator, setDropIndicator] = useState<DropIndicator>(null);
  const [bulkMoveToCategoryId, setBulkMoveToCategoryId] = useState('');
  const [bulkMoveVersion, setBulkMoveVersion] = useState(0);

  const [editingLink, setEditingLink] = useState<EditingLink | null>(null);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [targetCategoryId, setTargetCategoryId] = useState<string>('');

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };

    const handlePopState = () => {
      const next = getPageFromUrl();
      if (activePage === 'categories' && isCategoriesDirty && next !== 'categories') {
        window.history.replaceState(null, '', new URL(window.location.href));
        return;
      }

      setActivePage(next);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (activePage !== 'categories') return;
      if (!isCategoriesDirty) return;
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('keydown', handleEsc);
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [activePage, isCategoriesDirty]);

  const totalSelectedCount = useMemo(() => {
    return Object.values(selectedLinks).reduce((acc, ids) => acc + ids.length, 0);
  }, [selectedLinks]);

  const sortedCategories = useMemo(() => {
    const groupIndex = new Map<string, number>();
    for (let i = 0; i < (config.site.groupOrder ?? []).length; i++) {
      groupIndex.set(config.site.groupOrder![i], i);
    }

    const groupKeyOf = (c: NavCategory): string => (c.group?.trim() ? c.group.trim() : '');

    return [...config.categories].sort((a, b) => {
      const ga = groupKeyOf(a);
      const gb = groupKeyOf(b);

      if (ga !== gb) {
        if (!ga && gb) return -1;
        if (ga && !gb) return 1;

        const ia = ga ? groupIndex.get(ga) : undefined;
        const ib = gb ? groupIndex.get(gb) : undefined;

        const ha = ia !== undefined;
        const hb = ib !== undefined;
        if (ha && hb) return ia - ib;
        if (ha) return -1;
        if (hb) return 1;

        return ga.localeCompare(gb);
      }

      const oa = a.order ?? 0;
      const ob = b.order ?? 0;
      if (oa !== ob) return oa - ob;

      return a.name.localeCompare(b.name);
    });
  }, [config.categories, config.site.groupOrder]);

  const allowSorting = !searchTerm.trim();

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return sortedCategories;
    const term = searchTerm.toLowerCase();

    return sortedCategories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) =>
            item.name.toLowerCase().includes(term) || item.url.toLowerCase().includes(term) || (item.desc?.toLowerCase().includes(term) ?? false),
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [sortedCategories, searchTerm]);

  const handleToggleSelect = (categoryId: string, linkId: string) => {
    setSelectedLinks((prev) => {
      const current = prev[categoryId] ?? [];
      const next = current.includes(linkId) ? current.filter((id) => id !== linkId) : [...current, linkId];

      const newSelected = { ...prev, [categoryId]: next };
      if (next.length === 0) delete newSelected[categoryId];
      return newSelected;
    });
  };

  const handleBulkDelete = () => {
    showConfirm(
      m.admin.bulkDelete,
      m.admin.confirmBulkDelete(totalSelectedCount),
      async () => {
        let nextConfig = { ...config };
        for (const [catId, linkIds] of Object.entries(selectedLinks)) {
          nextConfig = removeLinksFromCategory(nextConfig, catId, linkIds);
        }

        const ok = await props.onSaveConfig(nextConfig);
        if (ok) setSelectedLinks({});
      },
      'danger'
    );
  };

  const handleBulkMove = async (toCategoryId: string) => {
    let nextConfig = { ...config };
    for (const [fromCatId, linkIds] of Object.entries(selectedLinks)) {
      if (fromCatId === toCategoryId) continue;
      nextConfig = moveLinksToCategory(nextConfig, fromCatId, toCategoryId, linkIds);
    }

    const ok = await props.onSaveConfig(nextConfig);
    if (ok) setSelectedLinks({});
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const categoryDomId = (categoryId: string) => `admin-cat:${categoryId}`;
  const linkDomId = (categoryId: string, linkId: string) => `admin-link:${categoryId}:${linkId}`;

  const applyDropIndicator = (event: DragOverEvent, overDomId: string) => {
    const { over, active } = event;
    if (!over || active.id === over.id) {
      setDropIndicator(null);
      return;
    }

    const overEl = document.getElementById(overDomId);
    if (!overEl) {
      setDropIndicator(null);
      return;
    }

    const overRect = overEl.getBoundingClientRect();
    const activeRect = event.active.rect.current.translated;
    if (!activeRect) return;

    const activeCenterY = activeRect.top + activeRect.height / 2;
    const overCenterY = overRect.top + overRect.height / 2;

    setDropIndicator({
      domId: overDomId,
      position: activeCenterY < overCenterY ? 'top' : 'bottom',
    });
  };

  const handleCategoryDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setDropIndicator(null);
      return;
    }

    applyDropIndicator(event, categoryDomId(String(over.id)));
  };

  const handleLinkDragOver = (categoryId: string) => (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setDropIndicator(null);
      return;
    }

    applyDropIndicator(event, linkDomId(categoryId, String(over.id)));
  };

  const handleCategoryDragEnd = async (event: DragEndEvent) => {
    setDropIndicator(null);
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const ids = sortedCategories.map((c) => c.id);
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;

    const nextIds = arrayMove(ids, fromIndex, toIndex);
    await props.onSaveConfig(reorderCategoriesByIds(config, nextIds));
  };

  const handleLinkDragEnd = async (categoryId: string, event: DragEndEvent) => {
    setDropIndicator(null);
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const category = config.categories.find((c) => c.id === categoryId);
    if (!category) return;

    const ids = category.items.map((i) => i.id);
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;

    const nextIds = arrayMove(ids, fromIndex, toIndex);
    await props.onSaveConfig(reorderLinksInCategoryByIds(config, categoryId, nextIds));
  };

  const handleSaveLink = async (catId: string, link: NavLink) => {
    let nextConfig = config;
    if (editingLink && editingLink.categoryId !== catId) {
      nextConfig = removeLinksFromCategory(config, editingLink.categoryId, [editingLink.link.id]);
    }
    nextConfig = upsertLinkInCategory(nextConfig, catId, link);
    await props.onSaveConfig(nextConfig);
    setEditingLink(null);
    setIsAddLinkModalOpen(false);
  };

  const handleDeleteLink = async (catId: string, linkId: string) => {
    const nextConfig = removeLinksFromCategory(config, catId, [linkId]);
    await props.onSaveConfig(nextConfig);
  };

  const categoryIds = useMemo(() => sortedCategories.map((c) => c.id), [sortedCategories]);

  const renderLinksPage = () => (
    <>
      <header className="admin-header">
        <h1 className="admin-title">{m.admin.links}</h1>
        <div className="admin-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              setTargetCategoryId(sortedCategories[0]?.id || '');
              setIsAddLinkModalOpen(true);
            }}
          >
            {m.admin.add}
          </button>
        </div>
      </header>

      <div className="admin-search-container">
        <span className="admin-search-icon">🔍</span>
        <input
          className="admin-search-input"
          placeholder={m.admin.searchLinks}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {allowSorting ? (
        <>
          <div className="admin-dnd-helper">{m.admin.dragToReorderHelper}</div>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={handleCategoryDragOver}
            onDragEnd={handleCategoryDragEnd}
          >
            <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
              <div className="admin-categories">
                {sortedCategories.map((category) => (
                  <SortableCategorySection
                    key={category.id}
                    category={category}
                    domId={categoryDomId(category.id)}
                    canDrag={allowSorting}
                    addLabel={m.admin.add}
                    onAddLink={() => {
                      setTargetCategoryId(category.id);
                      setIsAddLinkModalOpen(true);
                    }}
                    dropIndicator={dropIndicator?.domId === categoryDomId(category.id) ? dropIndicator.position : null}
                  >
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragOver={handleLinkDragOver(category.id)}
                      onDragEnd={async (event) => handleLinkDragEnd(category.id, event)}
                    >
                      <SortableContext items={category.items.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                        <div className="admin-link-list">
                          {category.items.map((link) => (
                            <SortableLinkRow
                              key={link.id}
                              categoryId={category.id}
                              link={link}
                              domId={linkDomId(category.id, link.id)}
                              selected={selectedLinks[category.id]?.includes(link.id) ?? false}
                              canDrag={allowSorting}
                              editLabel={m.admin.edit}
                              onToggleSelected={() => handleToggleSelect(category.id, link.id)}
                              onEdit={() => setEditingLink({ categoryId: category.id, link })}
                              dropIndicator={
                                dropIndicator?.domId === linkDomId(category.id, link.id) ? dropIndicator.position : null
                              }
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  </SortableCategorySection>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <div className="admin-categories">
          {filteredCategories.map((category) => (
            <section key={category.id} className="admin-category-section">
              <header className="admin-category-header">
                <div className="admin-category-info">
                  <span className="admin-category-icon">{getCategoryIcon(category)}</span>
                  <h3 className="admin-category-name">{category.name}</h3>
                  {category.group ? <span className="admin-category-group">{category.group}</span> : null}
                </div>
                <div className="admin-category-actions">
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setTargetCategoryId(category.id);
                      setIsAddLinkModalOpen(true);
                    }}
                  >
                    {m.admin.add}
                  </button>
                </div>
              </header>
              <div className="admin-link-list">
                {category.items.map((link) => (
                  <div
                    key={link.id}
                    className={`admin-link-row ${selectedLinks[category.id]?.includes(link.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedLinks[category.id]?.includes(link.id) || false}
                      onChange={() => handleToggleSelect(category.id, link.id)}
                    />
                    <div className="admin-link-name min-w-0">
                      <span className="text-ellipsis min-w-0">
                        {link.name}
                      </span>
                    </div>
                    <div className="admin-link-url">{link.url}</div>
                    <div className="admin-link-meta">
                      <div className="admin-link-url-mobile">{link.url}</div>
                      {link.desc && <div className="admin-link-desc">{link.desc}</div>}
                      {link.tags && link.tags.length > 0 && (
                        <div className="admin-link-tags">
                          {link.tags.map((tag) => (
                            <span key={tag} className="admin-link-tag">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="admin-link-actions">
                      <button className="btn btn-sm" onClick={() => setEditingLink({ categoryId: category.id, link })}>
                        {m.admin.edit}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div className="admin-layout">
      <AdminDialog 
        {...dialog} 
        onClose={closeDialog} 
      />
      <div className={`admin-overlay ${isSidebarOpen ? 'visible' : ''}`} onClick={() => setIsSidebarOpen(false)} />
      
      <aside className={`admin-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="admin-sidebar-header">
          <h2 className="admin-sidebar-title">
            {props.config.site.title} {m.app.adminTitleSuffix}
          </h2>
          {props.user.username !== 'dev' && <div className="admin-sidebar-user">{props.user.username}</div>}
        </div>
        <nav className="admin-sidebar-nav">
          <button 
            className={`admin-nav-item ${activePage === 'links' ? 'active' : ''}`} 
            onClick={() => goToPage('links')}
          >
            <span>{m.admin.links}</span>
          </button>
          <button 
            className={`admin-nav-item ${activePage === 'categories' ? 'active' : ''}`} 
            onClick={() => goToPage('categories')}
          >
            <span>{m.admin.categoriesAndGroups}</span>
          </button>
          <button 
            className={`admin-nav-item ${activePage === 'import-export' ? 'active' : ''}`} 
            onClick={() => goToPage('import-export')}
          >
            <span>{m.admin.importExport}</span>
          </button>
          <div className="flex-1" />
          <button
            className="admin-nav-item"
            onClick={() => {
              showConfirm(
                m.admin.reset,
                m.admin.resetConfirm,
                async () => {
                  await props.onResetConfig();
                  setIsSidebarOpen(false);
                },
                'danger'
              );
            }}
          >
            <span>{m.admin.reset}</span>
          </button>
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-sidebar-footer-nav">
            <a className="admin-nav-item admin-nav-item-centered" href="/">
              {m.admin.backHome}
            </a>
            <button className="admin-nav-item admin-nav-item-centered" onClick={props.onLogout}>
              {m.admin.logout}
            </button>
          </div>

          {(() => {
            const match = __APP_VERSION__.match(/\bv\d+\.\d+\.\d+\b/);
            const version = match?.[0] ?? __APP_VERSION__;
            const commit = __APP_COMMIT__ ? __APP_COMMIT__.slice(0, 7) : '';
            const title = `© ${new Date().getFullYear()} du.dev · ${version}${commit ? ` · ${commit}` : ''}`;

            return (
              <div className="admin-sidebar-copyright" title={title}>
                © {new Date().getFullYear()}{' '}
                <a href="https://du.dev" target="_blank" rel="noreferrer">
                  du.dev
                </a>
                {' · '}
                {version}
                {commit ? (
                  <span className="admin-sidebar-footer-commit">{' · '}{commit}</span>
                ) : null}
              </div>
            );
          })()}
        </div>
      </aside>

      <div className="flex-1 flex-col min-w-0">
        <div className="admin-topbar">
          <button className="admin-hamburger" onClick={() => setIsSidebarOpen(true)} aria-label={m.nav.openMenu}>
            <span />
            <span />
            <span />
          </button>
          <h2 className="admin-sidebar-title admin-sidebar-title-sm">
            {props.config.site.title}
          </h2>
        </div>

        <main className="admin-main">
          {props.saveError ? (
            <div className="admin-conflict-banner">
              <span>{props.saveError}</span>
              <div className="flex-gap-12px">
                <button className="btn btn-primary" onClick={props.onReload}>
                  {m.admin.reload}
                </button>
                <button className="btn" onClick={props.onClearSaveError}>
                  {m.admin.close}
                </button>
              </div>
            </div>
          ) : null}

          {activePage === 'links' && renderLinksPage()}
          {activePage === 'categories' && (
            <CategoryPage
              config={config}
              onSave={async (next) => props.onSaveConfig(next)}
              onDirtyChange={(dirty) => setIsCategoriesDirty(dirty)}
            />
          )}
          {activePage === 'import-export' && (
            <ImportExportPage config={config} onSave={async (next) => props.onSaveConfig(next)} />
          )}
        </main>
      </div>

      {totalSelectedCount > 0 && activePage === 'links' ? (
        <div className="admin-bulk-bar">
          <div className="admin-bulk-info-wrapper">
            <span className="admin-bulk-info">{m.admin.selectedLinksCount(totalSelectedCount)}</span>
            <button
              className="admin-bulk-clear"
              onClick={() => setSelectedLinks({})}
              title={m.admin.cancel}
              aria-label={m.admin.cancel}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2.5" fill="none">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <AdminCombobox
            key={bulkMoveVersion}
            className="admin-combobox"
            inputClassName="admin-select"
            listClassName="admin-combobox-list"
            ariaLabel={m.admin.moveToCategory}
            placeholder={m.admin.moveToCategory}
            options={sortedCategories.map((c) => ({ value: c.id, label: c.name }))}
            value={bulkMoveToCategoryId}
            placement="top"
            onChange={(value) => {
              if (!value) return;
              setBulkMoveToCategoryId(value);
              void handleBulkMove(value).finally(() => {
                setBulkMoveToCategoryId('');
                setBulkMoveVersion((v) => v + 1);
              });
            }}
          />
          <div className="admin-bulk-bar-actions">
            <button className="btn btn-danger" onClick={handleBulkDelete}>
              {m.admin.bulkDelete}
            </button>
            <button className="btn btn-ghost" onClick={() => setSelectedLinks({})}>
              {m.admin.cancel}
            </button>
          </div>
        </div>
      ) : null}

      <LinkModal
        key={editingLink ? `edit:${editingLink.categoryId}:${editingLink.link.id}` : `add:${targetCategoryId}:${isAddLinkModalOpen ? 'open' : 'closed'}`}
        isOpen={isAddLinkModalOpen || !!editingLink}
        onClose={() => {
          setIsAddLinkModalOpen(false);
          setEditingLink(null);
        }}
        categoryId={editingLink?.categoryId || targetCategoryId}
        link={editingLink?.link}
        categories={sortedCategories}
        onSave={handleSaveLink}
        onDelete={handleDeleteLink}
      />
    </div>
  );
}
