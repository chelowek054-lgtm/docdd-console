import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../../../utils/http';
import { llmQueue } from '../../../../../utils/llm-gateway';

/** Отмена задания: ожидающее снимается, идущее получает сигнал отмены. Чужого проекта не касаемся. */
export default defineEventHandler((event) => {
  const job = llmQueue.get(getRouterParam(event, 'jobId') ?? '');
  if (!job || job.projectId !== getRouterParam(event, 'id')) return fail(event, 404, 'not_found', 'Такого задания нет');
  return { ok: llmQueue.cancel(job.id) };
});
