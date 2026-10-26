import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { DEFER_DIRECTIONS, type DeferDirection } from '../../../../../lib/deferred';
import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { BULK_LIMIT } from '../../../../../utils/bulk-service';
import { bulkDeferred } from '../../../../../utils/deferred-service';
import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { staleVersions } from '../../../../../utils/record-write';

/** Бэклог пачкой (R-0105, docs/03-server-api.md): «В бэклог» и «Вернуть в работу». */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  if ((event.context as { user?: { agent?: unknown } }).user?.agent) {
    return fail(event, 403, 'agent_deferred', 'В бэклог уводит и возвращает человек: агент может только предложить это текстом');
  }

  const body = await readBody<{ ids?: unknown; direction?: unknown; reason?: unknown; actor?: unknown; versions?: unknown }>(event);
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0 || !ids.every((item): item is string => typeof item === 'string' && item !== '')) {
    return fail(event, 400, 'ids_required', 'Не названы записи: нужен непустой список номеров');
  }
  if (ids.length > BULK_LIMIT) return fail(event, 400, 'ids_too_many', `За один раз — не больше ${BULK_LIMIT} записей`);
  const direction = body?.direction;
  if (typeof direction !== 'string' || !DEFER_DIRECTIONS.includes(direction as DeferDirection)) {
    return fail(event, 400, 'direction_invalid', 'Направление — `defer` или `return`');
  }
  const stale = staleVersions(project.root, body?.versions);
  if (stale.length > 0) {
    return fail(event, 409, 'record_changed_since_load', `Записи изменили с тех пор, как вы их открыли: ${stale.join(', ')}. Перечитайте и повторите`);
  }

  try {
    return bulkDeferred(project.root, ids as string[], direction as DeferDirection, typeof body?.reason === 'string' ? body.reason : '', typeof body?.actor === 'string' ? body.actor : '');
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'write_failed', 'Не удалось записать изменения', String(error));
  }
});
