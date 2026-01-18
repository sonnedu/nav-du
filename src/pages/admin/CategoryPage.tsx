import { useEffect, useMemo, useState } from 'react';

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragOverEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { AdminCombobox } from './AdminCombobox';
import { AdminDialog } from './AdminDialog';
import type { Messages } from '../../lib/i18nMessages';
import { useI18n } from '../../lib/useI18n';
import type { NavCategory, NavConfig } from '../../lib/navTypes';
import { deleteCategoryGroup, ensureCategoryIconsFromDefaults, ensureGroupOrder, renameCategoryGroup } from '../../lib/admin/navConfigOps';
import { slugifyId } from '../../lib/admin/adminUtils';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

function fingerprintCategoryEdits(categories: NavCategory[], groupOrder: string[]): string {
  return JSON.stringify({
    groupOrder,
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      group: c.group,
      icon: c.icon,
      order: c.order ?? null,
    })),
  });
}

function applySubsetOrder(base: string[], subsetSet: Set<string>, subsetOrder: string[]): string[] {
  const it = subsetOrder[Symbol.iterator]();
  return base.map((g) => {
    if (!subsetSet.has(g)) return g;
    const next = it.next();
    return next.done ? g : next.value;
  });
}

interface CategoryPageProps {
  config: NavConfig;
  onSave: (next: NavConfig) => Promise<boolean | void>;
  onDirtyChange?: (dirty: boolean) => void;
}

function SortableCategoryRow(props: {
  category: NavCategory;
  isZh: boolean;
  m: Messages;
  groups: string[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  onUpdate: (updates: Partial<NavCategory>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.category.id });
  const { category, m, groups, canMoveUp, canMoveDown, onUpdate, onMove, onDelete } = props;

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`admin-category-row ${isDragging ? 'is-dragging' : ''}`}
    >
      <div className="admin-category-col-icon">
        <span
          ref={setActivatorNodeRef}
          className="drag-handle mr-025"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder category"
          title="Drag to reorder"
        >
          <span className="drag-handle-dots" />
        </span>
        <input
          className="admin-input admin-category-icon-input"
          value={category.icon || ''}
          onChange={(e) => onUpdate({ icon: e.target.value.trim() || undefined })}
          placeholder={m.admin.icon}
          title="Icon emoji or string"
        />
      </div>

      <input
        className="admin-input admin-category-col-name"
        value={category.name}
        onChange={(e) => onUpdate({ name: e.target.value })}
      />

      <AdminCombobox
        className="admin-combobox admin-category-col-group"
        inputClassName="admin-select"
        listClassName="admin-combobox-list"
        ariaLabel={m.admin.group}
        placeholder={m.admin.group}
        options={groups.map((g) => ({ value: g, label: g }))}
        value={category.group || ''}
        onChange={(value) => onUpdate({ group: value || undefined })}
      />

      <div className="admin-category-col-actions">
        <button className="btn btn-sm" onClick={() => onMove(-1)} disabled={!canMoveUp}>
          ↑
        </button>
        <button className="btn btn-sm" onClick={() => onMove(1)} disabled={!canMoveDown}>
          ↓
        </button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>
          {m.admin.delete}
        </button>
      </div>
    </div>
  );
}

function SortableGroupRow(props: {
  group: string;
  domId: string;
  deleteLabel: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMove: (direction: -1 | 1) => void;
  onRename: (next: string) => void;
  onDelete: () => void;
  dropIndicator: 'top' | 'bottom' | null;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: props.group });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    display: 'flex',
    flexWrap: 'nowrap',
    gap: '0.5rem',
    alignItems: 'center',
    zIndex: isDragging ? 100 : 1,
  };

  const indicatorClass = props.dropIndicator ? `is-over-${props.dropIndicator}` : '';

  return (
    <div
      id={props.domId}
      ref={setNodeRef}
      style={style}
      className={`admin-group-row ${isDragging ? 'is-dragging' : ''} ${isOver && !isDragging ? 'is-over' : ''} ${indicatorClass}`}
    >
      <span
        ref={setActivatorNodeRef}
        className="drag-handle"
        {...attributes}
        {...listeners}
        aria-label="Drag to reorder group"
        title="Drag to reorder"
      >
        <span className="drag-handle-dots" />
      </span>

      <input className="admin-input flex-1-min-0" defaultValue={props.group} onBlur={(e) => props.onRename(e.target.value)} />

      <div className="flex-gap-05 text-nowrap shrink-0">
        <button className="btn btn-sm" onClick={() => props.onMove(-1)} disabled={!props.canMoveUp} aria-label="Move group up">
          ↑
        </button>
        <button className="btn btn-sm" onClick={() => props.onMove(1)} disabled={!props.canMoveDown} aria-label="Move group down">
          ↓
        </button>
        <button className="btn btn-danger btn-sm" onClick={props.onDelete}>
          {props.deleteLabel}
        </button>
      </div>
    </div>
  );
}

export function CategoryPage(props: CategoryPageProps) {
  const { m, isZh } = useI18n();
  const { onDirtyChange } = props;

  const DEFAULT_GROUP = '其他';

  const migrateGroupName = (name: string): string => {
    const trimmed = name.trim();
    if (trimmed === 'misc') return DEFAULT_GROUP;
    return trimmed;
  };

  const [categories, setCategories] = useState(() =>
    props.config.categories.map((c) => {
      const g = c.group ? migrateGroupName(c.group) : c.group;
      if (g === c.group) return c;
      return { ...c, group: g };
    }),
  );

  const [groupOrder, setGroupOrder] = useState(() => {
    const initial = (props.config.site.groupOrder ?? []).map(migrateGroupName);
    return initial.includes(DEFAULT_GROUP) ? initial : [...initial, DEFAULT_GROUP];
  });
  const [dropIndicator, setDropIndicator] = useState<{ domId: string; position: 'top' | 'bottom' } | null>(null);

  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedFingerprint, setLastSavedFingerprint] = useState(() => fingerprintCategoryEdits(categories, groupOrder));

  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState(DEFAULT_GROUP);
  const [newGroupName, setNewGroupName] = useState('');
  const [hideEmptyGroups, setHideEmptyGroups] = useState(false);

  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string | React.ReactNode;
    confirmLabel?: string;
    onConfirm?: () => void;
    variant?: 'danger' | 'primary';
    type?: 'confirm' | 'alert';
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));
  const showAlert = (title: string, message: string) => 
    setDialog({ isOpen: true, title, message, type: 'alert' });
  const showConfirm = (title: string, message: string, onConfirm: () => void, variant: 'danger' | 'primary' = 'primary') => 
    setDialog({ isOpen: true, title, message, onConfirm, variant, type: 'confirm' });

  const groups = useMemo(() => {
    const fromCats = new Set(categories.map((c) => c.group).filter(Boolean));
    const all = new Set([...groupOrder, ...fromCats]);
    return Array.from(all) as string[];
  }, [categories, groupOrder]);

  const groupsWithCategories = useMemo(() => {
    const set = new Set<string>();
    for (const c of categories) {
      const g = c.group?.trim();
      if (g) set.add(g);
    }
    return set;
  }, [categories]);

  const currentFingerprint = useMemo(() => fingerprintCategoryEdits(categories, groupOrder), [categories, groupOrder]);
  const isDirty = currentFingerprint !== lastSavedFingerprint;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const hasEmptyGroups = useMemo(() => {
    return groups.some((g) => !groupsWithCategories.has(g));
  }, [groups, groupsWithCategories]);

  const effectiveHideEmptyGroups = hideEmptyGroups && hasEmptyGroups;

  const orderedGroupsAll = useMemo(() => {
    const ordered = groupOrder.filter((g) => groups.includes(g));
    for (const g of groups) {
      if (!ordered.includes(g)) ordered.push(g);
    }
    return ordered;
  }, [groupOrder, groups]);

  const sortedGroups = useMemo(() => {
    if (!effectiveHideEmptyGroups) return orderedGroupsAll;
    return orderedGroupsAll.filter((g) => groupsWithCategories.has(g));
  }, [effectiveHideEmptyGroups, orderedGroupsAll, groupsWithCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const groupDomId = (group: string) => `admin-group:${group}`;

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    if (!over || active.id === over.id) {
      setDropIndicator(null);
      return;
    }

    const overDomId = groupDomId(String(over.id));
    const overEl = document.getElementById(overDomId);
    if (!overEl) {
      setDropIndicator(null);
      return;
    }

    const overRect = overEl.getBoundingClientRect();
    const activeRect = event.active.rect.current.translated;

    if (activeRect) {
      const activeCenterY = activeRect.top + activeRect.height / 2;
      const overCenterY = overRect.top + overRect.height / 2;
      setDropIndicator({
        domId: overDomId,
        position: activeCenterY < overCenterY ? 'top' : 'bottom',
      });
    }
  };

  const handleGroupDragEnd = (event: DragEndEvent) => {
    setDropIndicator(null);
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const visibleGroups = sortedGroups;
    const fromIndex = visibleGroups.indexOf(String(active.id));
    const toIndex = visibleGroups.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;

    const nextVisible = arrayMove(visibleGroups, fromIndex, toIndex);
    const subsetSet = new Set(visibleGroups);
    setGroupOrder(applySubsetOrder(orderedGroupsAll, subsetSet, nextVisible));
  };

  const moveGroupWithinVisible = (group: string, direction: -1 | 1) => {
    const visibleGroups = sortedGroups;
    const fromIndex = visibleGroups.indexOf(group);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0) return;
    if (toIndex < 0 || toIndex >= visibleGroups.length) return;

    const nextVisible = arrayMove(visibleGroups, fromIndex, toIndex);
    const subsetSet = new Set(visibleGroups);
    setGroupOrder(applySubsetOrder(orderedGroupsAll, subsetSet, nextVisible));
  };

  const categoriesSortedForDisplay = useMemo(() => {
    const groupIndex = new Map<string, number>();
    for (let i = 0; i < groupOrder.length; i++) {
      groupIndex.set(groupOrder[i], i);
    }

    const groupKeyOf = (c: NavCategory): string => (c.group?.trim() ? c.group.trim() : '');

    return [...categories].sort((a, b) => {
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
  }, [categories, groupOrder]);

  const categoryIdsByGroup = useMemo(() => {
    const byGroup = new Map<string, string[]>();
    for (const c of categoriesSortedForDisplay) {
      const g = c.group?.trim() ? c.group.trim() : '';
      const existing = byGroup.get(g);
      if (existing) existing.push(c.id);
      else byGroup.set(g, [c.id]);
    }
    return byGroup;
  }, [categoriesSortedForDisplay]);

  const assertAllCategoriesHaveGroup = (): boolean => {
    for (const c of categories) {
      if (!c.group || !c.group.trim()) {
        showAlert(m.admin.group, m.admin.groupRequired);
        return false;
      }
    }

    return true;
  };

  const handleSaveAll = async () => {
    if (!assertAllCategoriesHaveGroup()) return;
    if (!isDirty && saveState !== 'error') return;

    setSaveState('saving');

    const nextConfig = ensureCategoryIconsFromDefaults(
      ensureGroupOrder({
        ...props.config,
        categories,
        site: {
          ...props.config.site,
          groupOrder: groupOrder.length > 0 ? groupOrder : undefined,
        },
      }),
    );

    if (nextConfig.site.groupOrder) {
      nextConfig.site.groupOrder = nextConfig.site.groupOrder.map(migrateGroupName);
    }
    nextConfig.categories = nextConfig.categories.map((c) => {
      const g = c.group ? migrateGroupName(c.group) : c.group;
      if (g === c.group) return c;
      return { ...c, group: g };
    });


    try {
      const ok = await props.onSave(nextConfig);
      if (ok === false) {
        setSaveState('error');
        return;
      }

      const nextGroupOrder = nextConfig.site.groupOrder ?? groupOrder;
      setCategories(nextConfig.categories);
      setGroupOrder(nextGroupOrder);
      setLastSavedFingerprint(fingerprintCategoryEdits(nextConfig.categories, nextGroupOrder));

      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 1500);
    } catch {
      setSaveState('error');
    }
  };

  const handleUpdateCategory = (id: string, updates: Partial<NavCategory>) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
  };

  const moveCategoryWithinGroup = (categoryId: string, direction: -1 | 1) => {
    const current = categoriesSortedForDisplay;
    const currentCategory = current.find((c) => c.id === categoryId);
    if (!currentCategory) return;

    const groupKey = currentCategory.group?.trim() ? currentCategory.group.trim() : '';
    const ids = categoryIdsByGroup.get(groupKey) ?? [];
    const fromIndex = ids.indexOf(categoryId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0) return;
    if (toIndex < 0 || toIndex >= ids.length) return;

    const nextIds = [...ids];
    const [moved] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, moved);

    const orderById = new Map<string, number>();
    for (let i = 0; i < nextIds.length; i += 1) orderById.set(nextIds[i], (i + 1) * 10);

    setCategories((prev) =>
      prev.map((c) => {
        const nextOrder = orderById.get(c.id);
        if (nextOrder === undefined) return c;
        return { ...c, order: nextOrder };
      }),
    );
  };

  const handleDeleteCategory = (id: string) => {
    const cat = categories.find((c) => c.id === id);
    if (!cat) return;
    
    const performDelete = () => {
      setCategories((prev) => prev.filter((c) => c.id !== id));
    };

    if (cat.items.length > 0) {
      showConfirm(
        m.admin.delete, 
        m.admin.confirmDeleteCategoryWithLinks(cat.name, cat.items.length),
        performDelete,
        'danger'
      );
    } else {
      performDelete();
    }
  };

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    if (!newCatGroup.trim()) {
      showAlert(m.admin.group, m.admin.groupRequired);
      return;
    }

    const id = slugifyId(newCatName);
    const newCat: NavCategory = {
      id,
      name: newCatName.trim(),
      group: newCatGroup.trim() || undefined,
      items: [],
      icon: '📌',
    };

    setCategories((prev) => [...prev, newCat]);
    setNewCatName('');
    setNewCatGroup(DEFAULT_GROUP);
  };

  const handleAddGroup = () => {
    if (!newGroupName.trim()) return;
    const name = newGroupName.trim();
    if (!groupOrder.includes(name)) {
      setGroupOrder((prev) => [...prev, name]);
    }
    setNewGroupName('');
  };

  const handleRenameGroup = (oldName: string, nextName: string) => {
    if (!nextName.trim() || oldName === nextName) return;
    const next = renameCategoryGroup({ ...props.config, categories }, oldName, nextName);
    setCategories(next.categories);
    setGroupOrder(next.site.groupOrder ?? []);
  };

  const handleDeleteGroup = (group: string) => {
    showConfirm(
      m.admin.delete,
      m.admin.confirmDeleteGroup(group),
      () => {
        const next = deleteCategoryGroup({ ...props.config, categories }, group);
        setCategories(next.categories);
        setGroupOrder(next.site.groupOrder ?? []);
      },
      'danger'
    );
  };

  const handleCategoryDragEnd = (event: DragEndEvent, groupKey: string) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = categoryIdsByGroup.get(groupKey) ?? [];
    const fromIndex = ids.indexOf(String(active.id));
    const toIndex = ids.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;

    const nextIds = arrayMove(ids, fromIndex, toIndex);
    const orderById = new Map<string, number>();
    for (let i = 0; i < nextIds.length; i += 1) orderById.set(nextIds[i], (i + 1) * 10);

    setCategories((prev) =>
      prev.map((c) => {
        const nextOrder = orderById.get(c.id);
        if (nextOrder === undefined) return c;
        return { ...c, order: nextOrder };
      }),
    );
  };

  return (
    <div className="admin-page-content">
      <AdminDialog 
        {...dialog} 
        onClose={closeDialog} 
      />
      <header className="admin-header">
        <h1 className="admin-title">{m.admin.categoriesGroupsTitle}</h1>
        <div className="admin-actions">
          {isDirty ? <span className="admin-save-status">{m.admin.unsavedChanges}</span> : null}
          {saveState === 'saving' ? <span className="admin-save-status">{m.admin.saving}</span> : null}
          {saveState === 'saved' ? <span className="admin-save-status">{m.admin.saveSuccess}</span> : null}

          <button className="btn btn-primary" onClick={handleSaveAll} disabled={!isDirty || saveState === 'saving'}>
            {m.admin.save}
          </button>
        </div>
      </header>

      <div className="flex-col-gap-2">
        <section className="admin-category-section p-1-5">
          <h4 className="admin-form-label mt-0">
            {m.admin.group} ({m.admin.dragToReorder})
          </h4>
           <div className="flex-between-center flex-gap-1 mb-05">
             <div className="admin-dnd-helper mb-0">
               {m.admin.dragToReorderHelper}
             </div>
             {hasEmptyGroups ? (
               <label className="inline-flex-center-gap-05 text-nowrap">
                 <input
                   type="checkbox"
                   checked={effectiveHideEmptyGroups}
                   onChange={(e) => setHideEmptyGroups(e.target.checked)}
                 />
                 {m.admin.hideEmptyGroups}
               </label>
             ) : null}
           </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragOver={handleDragOver} onDragEnd={handleGroupDragEnd}>
            <SortableContext items={sortedGroups} strategy={verticalListSortingStrategy}>
              <div className="flex-col-gap-05">
                {sortedGroups.map((g, idx) => (
                  <SortableGroupRow
                    key={g}
                    group={g}
                    domId={groupDomId(g)}
                    deleteLabel={m.admin.delete}
                    canMoveUp={idx > 0}
                    canMoveDown={idx < sortedGroups.length - 1}
                    onMove={(dir) => moveGroupWithinVisible(g, dir)}
                    onRename={(next) => handleRenameGroup(g, next)}
                    onDelete={() => handleDeleteGroup(g)}
                    dropIndicator={dropIndicator?.domId === groupDomId(g) ? dropIndicator.position : null}
                  />
                ))}
                {sortedGroups.length === 0 ? <div className="admin-sidebar-user">{m.admin.noGroups}</div> : null}
              </div>
            </SortableContext>
          </DndContext>

          <div className="admin-section-divider">
            <h4 className="admin-form-label">{m.admin.newGroup}</h4>
            <div className="flex-gap-05 text-nowrap" style={{ alignItems: 'center' }}>
              <input
                className="admin-input flex-1-min-0"
                placeholder={m.admin.newGroupNamePlaceholder}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddGroup()}
              />
              <button className="btn btn-primary btn-sm shrink-0" onClick={handleAddGroup} disabled={!newGroupName.trim()}>
                {m.admin.add}
              </button>
            </div>
          </div>
        </section>

        <section className="admin-category-section p-1-5">
          <h4 className="admin-form-label mt-0">{m.admin.categories}</h4>
          <div className="flex-col-gap-075">
            <div className="admin-category-row-header">
              <div className="col-icon">{m.admin.icon}</div>
              <div className="col-name">{m.admin.name}</div>
              <div className="col-group">{m.admin.group}</div>
              <div className="col-actions">{m.admin.actions}</div>
            </div>
            {sortedGroups.map((group) => {
              const groupKey = group.trim();
              const catsInGroup = categoriesSortedForDisplay.filter(c => (c.group?.trim() || '') === groupKey);
              if (catsInGroup.length === 0 && effectiveHideEmptyGroups) return null;

              return (
                <div key={group} className="flex-col-gap-05">
                  {catsInGroup.length > 0 && (
                    <div className="admin-group-label">
                      {group}
                    </div>
                  )}
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleCategoryDragEnd(e, groupKey)}>
                    <SortableContext items={catsInGroup.map(c => c.id)} strategy={verticalListSortingStrategy}>
                      <div className="flex-col-gap-05">
                        {catsInGroup.map((c) => {
                          const idsInGroup = categoryIdsByGroup.get(groupKey) ?? [];
                          const indexInGroup = idsInGroup.indexOf(c.id);
                          const canMoveUp = indexInGroup > 0;
                          const canMoveDown = indexInGroup >= 0 && indexInGroup < idsInGroup.length - 1;

                          return (
                            <SortableCategoryRow
                              key={c.id}
                              category={c}
                              isZh={isZh}
                              m={m}
                              groups={groups}
                              canMoveUp={canMoveUp}
                              canMoveDown={canMoveDown}
                              onUpdate={(updates) => handleUpdateCategory(c.id, updates)}
                              onMove={(dir) => moveCategoryWithinGroup(c.id, dir)}
                              onDelete={() => handleDeleteCategory(c.id)}
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </DndContext>
                </div>
              );
            })}
          </div>

          <div className="admin-section-divider">
            <h4 className="admin-form-label">{m.admin.newCategory}</h4>
            <div className="admin-new-category-row">
              <input
                className="admin-input"
                placeholder={m.admin.categoryNamePlaceholder}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
              <AdminCombobox
                className="admin-combobox"
                inputClassName="admin-select"
                listClassName="admin-combobox-list"
                ariaLabel={m.admin.group}
                placeholder={m.admin.group}
                options={groups.map((g) => ({ value: g, label: g }))}
                value={newCatGroup}
                onChange={setNewCatGroup}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAddCategory} disabled={!newCatName.trim()}>
                {m.admin.add}
              </button>
            </div>
          </div>
        </section>
      </div>

      <footer className="admin-footer-bar">
        <div className="admin-footer-status-wrap">
          <span className="admin-save-status">
            {saveState === 'saving' ? m.admin.saving : saveState === 'saved' ? m.admin.saveSuccess : isDirty ? m.admin.unsavedChanges : ''}
          </span>
          <span className="text-sub-sm admin-hide-mobile">
            {m.admin.dragToReorderHelper}
          </span>
        </div>
        <button className="btn btn-primary btn-min-120" onClick={handleSaveAll} disabled={!isDirty || saveState === 'saving'}>
          {m.admin.save}
        </button>
      </footer>
    </div>
  );
}
