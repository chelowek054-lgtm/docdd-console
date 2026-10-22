/**
 * Какие пункты шапки нужны какой роли (docs/04-ui.md, «Переключатель роли»).
 * Это вид, а не право: права проверяет сервер (ADR-0020), а здесь шапка лишь
 * не показывает того, что роли в работе не нужно.
 */

export const NAV_ROLES = ['architect', 'developer', 'pm', 'analyst', 'domain', 'designer', 'qa', 'devops', 'support', 'viewer'] as const;
export type NavRole = (typeof NAV_ROLES)[number];

/** Пустая строка — «Все роли»: видно всё. */
export type NavRoleChoice = NavRole | '';

export type NavKey =
  | 'overview' | 'requirements' | 'designDocs' | 'decisions' | 'contracts' | 'reference' | 'knowledge' | 'glossary'
  | 'tasks' | 'phases' | 'manager' | 'releases'
  | 'checks' | 'results' | 'issues' | 'graph'
  | 'maps' | 'inbox' | 'import'
  | 'design' | 'analyst' | 'practices';

const BY_ROLE: Record<NavRole, readonly NavKey[]> = {
  architect: ['requirements', 'designDocs', 'decisions', 'contracts', 'reference', 'knowledge', 'glossary', 'tasks', 'phases', 'manager', 'checks', 'results', 'issues', 'graph', 'maps', 'import', 'design', 'practices'],
  developer: ['designDocs', 'decisions', 'contracts', 'reference', 'tasks', 'checks', 'results', 'issues', 'maps', 'design'],
  pm: ['requirements', 'knowledge', 'tasks', 'phases', 'manager', 'releases', 'maps', 'inbox', 'import'],
  analyst: ['requirements', 'knowledge', 'glossary', 'maps', 'inbox', 'import', 'analyst'],
  domain: ['requirements', 'knowledge', 'glossary', 'inbox'],
  designer: ['designDocs', 'knowledge', 'tasks', 'design'],
  qa: ['requirements', 'contracts', 'tasks', 'releases', 'checks', 'results', 'issues'],
  devops: ['tasks', 'releases', 'results'],
  support: ['knowledge', 'glossary', 'releases', 'inbox'],
  viewer: ['requirements', 'knowledge', 'manager', 'releases']
};

/** Обзор нужен всем: это первый экран проекта. */
const ALWAYS: readonly NavKey[] = ['overview'];

export function navVisible(key: NavKey, role: NavRoleChoice): boolean {
  if (!role || ALWAYS.includes(key)) return true;
  return BY_ROLE[role]?.includes(key) ?? true;
}

export function isNavRole(value: unknown): value is NavRole {
  return typeof value === 'string' && (NAV_ROLES as readonly string[]).includes(value);
}
