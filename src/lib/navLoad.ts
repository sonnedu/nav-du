import { load as loadYaml } from 'js-yaml';

import type { NavConfig } from './navTypes';

export function parseNavConfigFromYaml(yamlText: string): NavConfig {
  const parsed = loadYaml(yamlText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid YAML: expected object');
  }
  return parsed as NavConfig;
}

export function sortCategories(config: NavConfig): NavConfig {
  return {
    ...config,
    categories: [...config.categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
  };
}
