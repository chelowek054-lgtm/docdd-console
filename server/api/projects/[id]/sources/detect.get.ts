import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { detectProjectSources } from '../../../../utils/source-scan';

/**
 * Автопоиск источников (R-0077): папки кода, клиента, документации и тестов, файлы контрактов, зависимостей
 * и отчётов CI. Ничего не пишет: находка — предложение, записывает человек (`POST …/sources/apply`).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    return detectProjectSources(project.root);
  } catch (error) {
    return fail(event, 422, 'detect_failed', 'Не удалось просмотреть проект', String(error));
  }
});
