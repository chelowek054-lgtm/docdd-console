import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { projectCatalog } from '../../../../utils/design-catalog-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/**
 * Матрица «компонент × состояние × стек» по выгрузкам каталогов историй и
 * найденные пробелы (docs/16-design-system.md). `null` — каталоги не объявлены.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    return { report: projectCatalog(project.root) };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'design_catalog_failed', 'Не удалось прочитать каталоги историй', String(error));
  }
});
