import type { NavCategory, NavConfig, NavLink, ThemeMode } from './navTypes';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function isNavLink(value: unknown): value is NavLink {
  if (!isRecord(value)) return false;
  if (!isString(value.id) || !isString(value.name) || !isString(value.url)) return false;
  if ('desc' in value && value.desc !== undefined && !isString(value.desc)) return false;
  if ('tags' in value && value.tags !== undefined && !isStringArray(value.tags)) return false;
  return true;
}

function isNavCategory(value: unknown): value is NavCategory {
  if (!isRecord(value)) return false;
  if (!isString(value.id) || !isString(value.name)) return false;
  if ('order' in value && value.order !== undefined && typeof value.order !== 'number') return false;
  if (!Array.isArray(value.items) || !value.items.every(isNavLink)) return false;
  return true;
}

export function isNavConfig(value: unknown): value is NavConfig {
  if (!isRecord(value)) return false;

  if (!isRecord(value.site) || !isString(value.site.title)) return false;
  if ('description' in value.site && value.site.description !== undefined && !isString(value.site.description)) return false;
  if ('defaultTheme' in value.site && value.site.defaultTheme !== undefined && !isThemeMode(value.site.defaultTheme)) return false;

  if (!Array.isArray(value.categories) || !value.categories.every(isNavCategory)) return false;

  return true;
}
