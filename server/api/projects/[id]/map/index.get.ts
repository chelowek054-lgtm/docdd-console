import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildProjectMap } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';

/*
 * Маршрут `/api/projects/:id/map`. Папка `map` внутри `[id]` — тот же приём,
 * что и с `index`: буквальный сегмент пути в Nitro иначе не получить.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    return buildProjectMap(project.root);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    return fail(event, 500, 'read_failed', 'Не удалось собрать карту проекта', String(error));
  }
});
