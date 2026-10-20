import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { runMetricCheck } from '../../../../../utils/verified-service';

/** Прогон проверки-метрики по запросу Prometheus (R-0066); отчёт passed/failed/skipped. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = await readBody<{ actor?: unknown }>(event).catch(() => null);
  try {
    const outcome = await runMetricCheck(project.root, recordId, typeof body?.actor === 'string' ? body.actor : '');
    if (!outcome.ok) return fail(event, outcome.status, outcome.code, outcome.message);
    return outcome;
  } catch (error) {
    return fail(event, 500, 'metric_failed', 'Не удалось прогнать проверку-метрику', String(error));
  }
});
