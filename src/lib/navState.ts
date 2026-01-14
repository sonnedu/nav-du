import navYaml from '../data/nav.yaml?raw';

import { parseNavConfigFromYaml, sortCategories } from './navLoad';
import { loadNavOverride } from './storage';
import type { NavConfig } from './navTypes';
import { isNavConfig } from './navValidate';

export function loadNavConfig(): NavConfig {
  const base = sortCategories(parseNavConfigFromYaml(navYaml));

  const override = loadNavOverride();
  if (override && isNavConfig(override)) {
    return sortCategories(override);
  }

  return base;
}
