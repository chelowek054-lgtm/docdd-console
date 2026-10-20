import { defineEventHandler, getRouterParam, setHeader } from 'h3';

import { prometheusMetrics } from '../../../lib/metrics';
import { fail } from '../../../utils/http';
import { loadIndex } from '../../../utils/index-service';
import { findProject } from '../../../utils/projects';

/** Метрики процесса для Prometheus/Grafana (R-0065): текст, а не JSON. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    setHeader(event, 'content-type', 'text/plain; version=0.0.4; charset=utf-8');
    return prometheusMetrics(loadIndex(project.root), project.id);
  } catch (error) {
    return fail(event, 500, 'read_failed', 'Не удалось собрать метрики', String(error));
  }
});
