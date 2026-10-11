import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { projectScreens } from '../../../../utils/design-screens-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/**
 * Опись снимков экранов проекта: экран · ширина · тема · когда снят
 * (docs/16-design-system.md). Экраны — из подтверждённой карты путей; снимки
 * приложение не делает, а читает.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    return projectScreens(project.root);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'design_screens_failed', 'Не удалось собрать опись снимков', String(error));
  }
});
