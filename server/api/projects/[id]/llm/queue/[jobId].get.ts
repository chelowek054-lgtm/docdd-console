import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../../../utils/http';
import { llmQueue } from '../../../../../utils/llm-gateway';
import { loadJobs } from '../../../../../utils/llm-jobs-store';

/** Результат задания по идентификатору: ответ, ошибка, время, итог. Чужого проекта не отдаём. */
export default defineEventHandler((event) => {
  const projectId = getRouterParam(event, 'id') ?? '';
  const id = getRouterParam(event, 'jobId') ?? '';
  const job = llmQueue.get(id) ?? loadJobs(projectId).find((item) => item.id === id);
  if (!job || job.projectId !== projectId) return fail(event, 404, 'not_found', 'Такого задания нет');
  return { job };
});
