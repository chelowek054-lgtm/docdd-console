import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
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
