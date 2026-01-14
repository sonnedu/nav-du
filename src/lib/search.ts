import Fuse from 'fuse.js';
import { pinyin } from 'pinyin-pro';

import type { IndexedNavLink, NavConfig, NavLink } from './navTypes';

function safeUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

function toPinyinFull(text: string): string {
  if (!text) return '';
  return pinyin(text, { toneType: 'none', separator: ' ' }).toLowerCase();
}

function toPinyinInitials(text: string): string {
  if (!text) return '';
  return pinyin(text, { toneType: 'none', pattern: 'first', separator: '' }).toLowerCase();
}

export function indexNavLinks(config: NavConfig): IndexedNavLink[] {
  const indexed: IndexedNavLink[] = [];

  for (const category of config.categories) {
    for (const item of category.items) {
      const urlHost = safeUrlHost(item.url);

      const namePinyinFull = toPinyinFull(item.name);
      const namePinyinInitials = toPinyinInitials(item.name);

      const desc = item.desc ?? '';
      const descPinyinFull = toPinyinFull(desc);
      const descPinyinInitials = toPinyinInitials(desc);

      const searchable = [
        item.name,
        desc,
        item.url,
        urlHost,
        namePinyinFull,
        namePinyinInitials,
        descPinyinFull,
        descPinyinInitials,
      ]
        .join(' ')
        .toLowerCase();

      indexed.push({
        ...item,
        categoryId: category.id,
        categoryName: category.name,
        urlHost,
        namePinyinFull,
        namePinyinInitials,
        descPinyinFull,
        descPinyinInitials,
        searchable,
      });
    }
  }

  return indexed;
}

export type SearchResult = {
  link: IndexedNavLink;
  score: number;
};

export function createNavFuseIndex(indexedLinks: IndexedNavLink[]): Fuse<IndexedNavLink> {
  return new Fuse(indexedLinks, {
    keys: [
      { name: 'name', weight: 3.0 },
      { name: 'desc', weight: 2.0 },
      { name: 'urlHost', weight: 1.5 },
      { name: 'url', weight: 1.0 },
      { name: 'namePinyinFull', weight: 1.6 },
      { name: 'namePinyinInitials', weight: 1.4 },
      { name: 'descPinyinFull', weight: 0.8 },
      { name: 'descPinyinInitials', weight: 0.6 },
      { name: 'searchable', weight: 0.4 },
    ],
    threshold: 0.4,
    distance: 120,
    ignoreLocation: true,
    includeScore: true,
    minMatchCharLength: 1,
  });
}

export function searchNav(fuse: Fuse<IndexedNavLink>, query: string, limit = 60): SearchResult[] {
  const q = query.trim();
  if (!q) return [];

  return fuse
    .search(q)
    .slice(0, limit)
    .map((r) => ({
      link: r.item,
      score: r.score ?? 1,
    }));
}

export function patchLinkDefaults(link: NavLink): NavLink {
  return {
    ...link,
    tags: link.tags?.filter((t) => t.trim().length > 0),
  };
}
