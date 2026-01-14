import { useMemo } from 'react';

import type { IndexedNavLink, NavConfig } from './navTypes';
import { createNavFuseIndex, indexNavLinks, searchNav } from './search';

export function useIndexedLinks(config: NavConfig): IndexedNavLink[] {
  return useMemo(() => indexNavLinks(config), [config]);
}

export function useFuseIndex(indexedLinks: IndexedNavLink[]) {
  return useMemo(() => createNavFuseIndex(indexedLinks), [indexedLinks]);
}

export function runSearch(indexedLinks: IndexedNavLink[], query: string) {
  const fuse = createNavFuseIndex(indexedLinks);
  return searchNav(fuse, query);
}
