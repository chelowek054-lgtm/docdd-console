import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import type { IndexRecord } from '../../../../lib/types';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject, touchProject } from '../../../../utils/projects';

/*
 * Маршрут `/api/projects/:id/index` из docs/03-server-api.md. Папка `index`
 * внутри `[id]` — единственный способ получить в Nitro буквальный сегмент
 * `index`: файл `[id]/index.get.ts` означал бы `/api/projects/:id`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const refresh = getQuery(event)['refresh'] === '1';
  try {
    const index = loadIndex(project.root, refresh);
    await touchProject(id);
    // issues=0: нарушения (~26 КБ) уезжают отдельным запросом и не попадают в HTML.
    if (getQuery(event)['issues'] === '0') return { ...index, issues: [], records: index.records.map((record) => leanRecord(record, getQuery(event)['light'])) }; // лёгкий индекс: backlinks уезжают в /backlinks, extra нужен только задачам; light=2 — список задач (leanRecord)
    return index;
  } catch (error) {
    if (error instanceof WorkspaceError) {
      const status = error.code === 'project_not_found' ? 404 : 422;
      return fail(event, status, error.code, error.message, error.detail);
    }
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    return fail(event, 500, 'read_failed', 'Не удалось собрать индекс проекта', String(error));
  }
});

/** Что рисуют списки кроме задач: вид проверки на «Сверке», версия и окружения на «Релизах». */
const LEAN_EXTRA: Record<string, readonly string[]> = { verification: ['kind'], release: ['version', 'environments'] };

function pick(extra: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of keys) if (key in extra) out[key] = extra[key];
  return out;
}

/**
 * Лёгкая запись для HTML. light=1 обнуляет то, что тяжёлым страницам не нужно;
 * light=2 (список задач) вовсе не отдаёт ключи, которых строка не рисует, —
 * в payload каждый ключ повторяется на каждую запись, и null стоит столько же.
 */
function leanRecord(record: IndexRecord, light: unknown): IndexRecord {
  const base = { ...record, backlinks: {}, extra: record.type === 'task' ? record.extra : pick(record.extra, LEAN_EXTRA[record.type] ?? []) };
  if (light === '2') {
    const { created: _c, updated: _u, path: _p, section: _s, backlinks: _b, ...rest } = base;
    const extra: Record<string, unknown> = {};
    // Только то, что рисует строка задачи; остальное подкачивается карточкой записи.
    if (record.type === 'task') for (const key of ['change', 'reuse', 'assignee', 'reviewer']) if (key in record.extra) extra[key] = record.extra[key];
    return { ...rest, extra } as IndexRecord;
  }
  return light === '1' ? { ...base, tags: [], created: null, updated: null, owner: null, phase: null, path: '' } : base;
}
