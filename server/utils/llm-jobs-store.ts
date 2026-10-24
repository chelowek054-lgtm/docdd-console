import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { markInterrupted, trimJobs, type QueueJob } from '../lib/llm-queue';

/**
 * Журнал заданий к модели: `.data/llm-jobs/<проект>.json` (ADR-0017, R-0010).
 * Очередь живёт в памяти, а результат — здесь: переживает обновление страницы и перезапуск сервера.
 */
export const JOBS_DIR = resolve(process.cwd(), '.data', 'llm-jobs');
/** Один запуск сервера — один идентификатор. */
export const BOOT_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const jobsFile = (projectId: string, dir: string = JOBS_DIR) => resolve(dir, `${projectId.replace(/[^\w.-]/g, '_')}.json`);

export function readJobs(projectId: string, dir: string = JOBS_DIR): QueueJob[] {
  const file = jobsFile(projectId, dir);
  if (!existsSync(file)) return [];
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? (parsed as QueueJob[]) : [];
  } catch { return []; }
}

function writeJobs(projectId: string, jobs: QueueJob[], dir: string): void {
  const file = jobsFile(projectId, dir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(trimJobs(jobs), null, 2), 'utf8');
}

/** Чтение с пометкой «прервано перезапуском» для заданий прошлых запусков; пометка сразу пишется в файл. */
export function loadJobs(projectId: string, dir: string = JOBS_DIR, boot: string = BOOT_ID): QueueJob[] {
  const raw = readJobs(projectId, dir);
  const marked = markInterrupted(raw, boot);
  if (marked.some((job, i) => job !== raw[i])) writeJobs(projectId, marked, dir);
  return marked;
}

/** Записать состояние задания (новое — в конец, известное — на месте). */
export function saveJob(job: QueueJob, dir: string = JOBS_DIR): void {
  const jobs = readJobs(job.projectId, dir);
  const at = jobs.findIndex((item) => item.id === job.id);
  if (at >= 0) jobs[at] = job; else jobs.push(job);
  writeJobs(job.projectId, jobs, dir);
}
