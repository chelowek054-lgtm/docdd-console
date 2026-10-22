import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { scanTests } from '../../../../utils/test-checks-service';

/** Проверки из существующих тестов (R-0079): найденные тесты с требованием и причиной, покрытие требований. Ничего не пишет. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    return scanTests(project.root);
  } catch (error) {
    return fail(event, 422, 'scan_failed', 'Не удалось просмотреть тесты проекта', String(error));
  }
});
