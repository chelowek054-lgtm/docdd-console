import { existsSync, readFileSync } from 'node:fs';

import { defineEventHandler, getQuery } from 'h3';

import { AUDIT_FILE } from '../middleware/audit';
import { fail } from '../utils/http';

/**
 * Журнал доступа для администратора (T-0018). Последние строки, новые сверху;
 * `actor` и `project` сужают выборку. Если слой входа выставил пользователя —
 * смотреть может только администратор; без входа (локальный режим) открыто.
 */
export default defineEventHandler((event) => {
  const user = (event.context as { user?: { role?: unknown } }).user;
  if (user && user.role !== 'admin') {
    return fail(event, 403, 'forbidden', 'Журнал доступа виден только администратору');
  }
  const query = getQuery(event);
  const actor = typeof query['actor'] === 'string' ? query['actor'] : '';
  const project = typeof query['project'] === 'string' ? query['project'] : '';
  const limit = Math.min(Number(query['limit']) || 200, 1000);

  const lines = existsSync(AUDIT_FILE) ? readFileSync(AUDIT_FILE, 'utf8').split('\n').filter(Boolean) : [];
  const entries = lines
    .map((line) => { try { return JSON.parse(line) as Record<string, unknown>; } catch { return null; } })
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .filter((entry) => (!actor || entry['actor'] === actor) && (!project || entry['project'] === project))
    .reverse()
    .slice(0, limit);
  return { entries };
});
