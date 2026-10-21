import { realpathSync } from 'node:fs';
import { delimiter, isAbsolute, relative, resolve, sep } from 'node:path';

import type { H3Event } from 'h3';

import { fail } from './http';

/**
 * Режим общего сервера (docs/adr/0018-shared-server.md, docs/15-team-platform.md, аудит).
 * Включается `DOCDD_MODE=shared`; локальный режим не меняется.
 */
export function isSharedMode(): boolean {
  return process.env.DOCDD_MODE === 'shared';
}

/**
 * Отказ 403 `server_mode_shared` для маршрутов, которые без входа (права, фаза 26) на общем
 * сервере открывать нельзя: свободный запрос к модели, полный доступ, слияние.
 */
export function sharedDenied(event: H3Event, what: string) {
  if (!isSharedMode()) return null;
  // Право проверяет middleware/auth.ts (work/merge/model); без входа прав нет — отказ.
  if (process.env['DOCDD_AUTH'] === 'on') return null;
  return fail(event, 403, 'server_mode_shared', `${what}: на общем сервере выключено без входа (DOCDD_MODE=shared, нужен DOCDD_AUTH=on)`);
}

/** Разрешённые каталоги проектов из `DOCDD_PROJECT_ROOTS` (разделитель — как у PATH). */
export function projectRoots(): string[] {
  return (process.env.DOCDD_PROJECT_ROOTS ?? '')
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      try {
        return realpathSync.native(resolve(item));
      } catch {
        return resolve(item);
      }
    });
}

/**
 * Путь проекта допустим, если лежит внутри одного из разрешённых каталогов. Вызывающий
 * передаёт уже развёрнутый (`realpath`) путь, поэтому `..` и ссылки наружу не проходят.
 * Список пуст: в локальном режиме без ограничений, в shared — отказ (переменная обязательна).
 */
export function rootAllowed(root: string): boolean {
  const roots = projectRoots();
  if (roots.length === 0) return !isSharedMode();
  return roots.some((base) => {
    const rel = relative(base, root);
    // Сегмент `..` — выход наружу; каталог `..foo` законен, поэтому сравниваем сегменты, а не префикс.
    const first = rel.split(sep)[0];
    return rel === '' || (first !== '..' && !isAbsolute(rel));
  });
}
