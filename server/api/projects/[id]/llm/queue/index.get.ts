import { defineEventHandler, getRouterParam } from 'h3';

import { llmQueue } from '../../../../../utils/llm-gateway';
import { loadJobs } from '../../../../../utils/llm-jobs-store';

/**
 * Очередь запросов к модели по проекту: видна всей команде. К живым заданиям
 * добавлены недавно завершённые из журнала `.data/llm-jobs` (с ответом) — так
 * ответ находится после обновления страницы и перезапуска сервера.
 */
export default defineEventHandler((event) => {
  const projectId = getRouterParam(event, 'id') ?? '';
  const live = llmQueue.list(projectId);
  const liveIds = new Set(live.map((job) => job.id));
  const stored = loadJobs(projectId).filter((job) => !liveIds.has(job.id));
  return { jobs: [...stored, ...live].sort((a, b) => a.createdAt - b.createdAt) };
});
