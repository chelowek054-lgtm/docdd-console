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
  | 'checks' | 'run' | 'results' | 'issues' | 'graph'
  | 'maps' | 'inbox' | 'import'
  | 'design' | 'analyst' | 'practices';

const BY_ROLE: Record<NavRole, readonly NavKey[]> = {
  architect: ['requirements', 'designDocs', 'decisions', 'contracts', 'reference', 'knowledge', 'glossary', 'tasks', 'phases', 'manager', 'checks', 'run', 'results', 'issues', 'graph', 'maps', 'import', 'design', 'practices'],
  developer: ['designDocs', 'decisions', 'contracts', 'reference', 'tasks', 'checks', 'run', 'results', 'issues', 'maps', 'design'],
  pm: ['requirements', 'knowledge', 'tasks', 'phases', 'manager', 'releases', 'maps', 'inbox', 'import'],
  analyst: ['requirements', 'knowledge', 'glossary', 'maps', 'inbox', 'import', 'analyst'],
  domain: ['requirements', 'knowledge', 'glossary', 'inbox'],
  designer: ['designDocs', 'knowledge', 'tasks', 'design'],
  qa: ['requirements', 'contracts', 'tasks', 'releases', 'checks', 'run', 'results', 'issues', 'graph'],
  devops: ['tasks', 'releases', 'run', 'results'],
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

/**
 * Слова, по которым глобальный поиск находит пункт меню, если человек потерялся
 * (docs/04-ui.md, «Поиск»): синонимы и то, что на экране делают, а не только подпись.
 */
export const NAV_HINTS: Record<NavKey, string> = {
  overview: 'обзор главная сводка дашборд прогресс overview dashboard',
  requirements: 'требования требование фичи что должно быть requirements',
  designDocs: 'проектные документы дизайн документ архитектура design docs',
  decisions: 'решения adr решение почему decisions',
  contracts: 'контракты api openapi схема формат contracts',
  reference: 'справочник справки библиотеки зависимости переиспользование reference',
  knowledge: 'знания вики confluence страницы база знаний knowledge wiki',
  glossary: 'глоссарий термины словарь glossary terms',
  tasks: 'задачи тикеты задача jira бэклог tasks backlog',
  phases: 'фазы этапы спринты план порядок phases sprints',
  manager: 'менеджер доска канбан дорожная карта вехи сводка заказчику board roadmap',
  releases: 'релизы версии выкладка окружения прод деплой releases deploy',
  checks: 'проверки тесты приёмка тестирование checks tests qa',
  run: 'прогон запуск отметить прошла провалена сборка тестировщик run',
  results: 'результаты прогоны отчёты тестов results runs',
  issues: 'нарушения ошибки предупреждения проблемы баги issues errors',
  graph: 'граф связи зависимости graph',
  maps: 'карты карта кода модули потоки пути функциональная карта maps architecture',
  inbox: 'входящее заметки идеи сырые inbox notes',
  import: 'импорт документации перенос jira confluence import',
  design: 'дизайн токены палитра темы компоненты storybook design tokens',
  analyst: 'помощник аналитика критерии противоречия analyst',
  practices: 'практики общие правила другие проекты practices'
};
