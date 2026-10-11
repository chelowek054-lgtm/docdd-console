import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { projectExports } from '../../../../utils/design-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/**
 * Выгрузка токенов в стеки проекта и сверка файлов темы
 * (docs/16-design-system.md, «Стеки и выгрузка»). Файл проекта не пишется:
 * его меняет задача модели в своей ветке, а сливает человек (ADR-0022).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const stack = getQuery(event)['stack'];
  try {
    return { stacks: projectExports(project.root, typeof stack === 'string' ? stack : undefined) };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'design_export_failed', 'Не удалось собрать выгрузку токенов', String(error));
  }
});
