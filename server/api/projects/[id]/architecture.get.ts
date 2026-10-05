import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError, normalizeRoot } from '../../../lib/paths';
import { WorkspaceError } from '../../../lib/workspace';
import { buildArchitecture } from '../../../utils/architecture-service';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

/**
 * Нарушения архитектуры (docs/07-maps.md, «Модули и публичный вход»). Отдельный
 * маршрут, а не часть `GET /map`: ему нужен манифест и список файлов кода, а
 * карте они ни к чему.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    return buildArchitecture(normalizeRoot(project.root));
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'architecture_failed', 'Не удалось проверить архитектуру', String(error));
  }
});
