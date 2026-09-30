import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { BULK_LIMIT } from '../../../../../utils/bulk-service';
import { fail } from '../../../../../utils/http';
import { linkIntentMap } from '../../../../../utils/intent-map-service';
import { findProject } from '../../../../../utils/projects';

/**
 * Общая карта-намерение на пачку `feature`-задач (docs/03-server-api.md).
 * Заводит черновик и ставит `affects` у задач; ничего не подтверждает.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ ids?: unknown }>(event);
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0 || !ids.every((item): item is string => typeof item === 'string' && item !== '')) {
    return fail(event, 400, 'ids_required', 'Не названы задачи: нужен непустой список номеров');
  }
  if (ids.length > BULK_LIMIT) {
    return fail(event, 400, 'ids_too_many', `За один раз — не больше ${BULK_LIMIT} задач`);
  }

  try {
    const outcome = linkIntentMap(project.root, ids as string[]);
    return outcome.ok ? outcome : fail(event, 409, outcome.code, outcome.message, outcome.skipped.map((item) => item.message).join(' '));
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'link_failed', 'Не удалось завести карту', String(error));
  }
});
