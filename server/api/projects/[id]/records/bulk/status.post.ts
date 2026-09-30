import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../../lib/paths';
import { BULK_DIRECTIONS, type BulkDirection } from '../../../../../lib/transitions';
import { WorkspaceError } from '../../../../../lib/workspace';
import { BULK_LIMIT, bulkStatus } from '../../../../../utils/bulk-service';
import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';

/**
 * Массовая смена статуса (docs/03-server-api.md). Целевой статус выбирает
 * сервер для каждой записи сам; ответ — отчёт по каждой, `200` и при отказах.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ ids?: unknown; direction?: unknown; actor?: unknown }>(event);
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0 || !ids.every((item): item is string => typeof item === 'string' && item !== '')) {
    return fail(event, 400, 'ids_required', 'Не названы записи: нужен непустой список номеров');
  }
  if (ids.length > BULK_LIMIT) {
    return fail(event, 400, 'ids_too_many', `За один раз — не больше ${BULK_LIMIT} записей`);
  }

  const direction = body?.direction;
  if (typeof direction !== 'string' || !BULK_DIRECTIONS.includes(direction as BulkDirection)) {
    return fail(event, 400, 'direction_invalid', 'Направление — `forward`, `back` или `approve`');
  }
  const actor = typeof body?.actor === 'string' ? body.actor : '';

  try {
    return bulkStatus(project.root, ids as string[], direction as BulkDirection, actor);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'write_failed', 'Не удалось записать изменения', String(error));
  }
});
