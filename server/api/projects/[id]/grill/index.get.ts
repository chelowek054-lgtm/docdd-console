import { defineEventHandler, getRouterParam } from 'h3';

import { GRILL_THEMES } from '../../../../lib/grill';
import { WorkspaceError } from '../../../../lib/workspace';
import { currentSession } from '../../../../utils/grill-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Текущая сессия допроса: из файла, поэтому переживает обновление страницы (R-0114). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    return { view: currentSession(project.root), themes: GRILL_THEMES };
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    throw error;
  }
});
