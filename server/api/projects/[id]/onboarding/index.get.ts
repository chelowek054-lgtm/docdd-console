import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../../utils/http';
import { onboardingReport } from '../../../../utils/onboarding-service';
import { findProject } from '../../../../utils/projects';

/**
 * Чек-лист «Готовность проекта» (R-0075, docs/03-server-api.md): шаги подключения со статусом,
 * вычисленным по состоянию проекта, и готовность одним числом. Читает файлы, ничего не пишет.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  return onboardingReport(project.root);
});
