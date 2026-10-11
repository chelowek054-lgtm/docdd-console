import type { SharedSource } from './types';

/**
 * Встроенный набор практик (docs/11-shared-sources.md, «Встроенный набор»;
 * ADR-0015): каталог `practices/` в репозитории консоли — обычный источник
 * практик, подключённый по зарезервированному пути `builtin`. Чистые функции.
 */

export const BUILTIN_SOURCE = 'builtin';

/** Что подключено, пока в манифесте нет записи `builtin`: общие принципы кода. */
export const DEFAULT_BUILTIN_TAGS: readonly string[] = ['general'];

/**
 * Источники проекта с встроенным набором первым. Записи `builtin` нет —
 * неявная с тегом `general`; есть — берётся как написана (`tags: []` отключает).
 */
export function withBuiltin(sources: readonly SharedSource[]): SharedSource[] {
  const own = sources.find((source) => source.path === BUILTIN_SOURCE);
  const rest = sources.filter((source) => source.path !== BUILTIN_SOURCE);
  return [own ?? { path: BUILTIN_SOURCE, tags: [...DEFAULT_BUILTIN_TAGS] }, ...rest];
}
