/**
 * Очередь запросов к модели на сервере (ADR-0019, R-0010).
 *
 * Задание живёт в памяти сервера, а не страницы: обновление страницы его не
 * обрывает, а список видит вся команда (права проверяет вызывающий API).
 * Без Nuxt и без файлов: запуск работы передаётся функцией.
 */

export type JobState = 'queued' | 'running' | 'done' | 'failed' | 'cancelled';

export interface QueueJob {
  id: string;
  projectId: string;
  user: string;
  kind: string;
  state: JobState;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  /** Короткое сообщение об итоге или причине отказа. */
  note?: string;
}

export type JobWork = (signal: AbortSignal) => Promise<{ ok: boolean; note?: string }>;

export class LlmQueue {
  private readonly jobs = new Map<string, QueueJob>();
  private readonly work = new Map<string, JobWork>();
  private readonly aborts = new Map<string, AbortController>();
  private running = 0;
  private counter = 0;

  /** `limit` — предел параллельности: модель и лимиты у людей общие. */
  constructor(private readonly limit = 2, private readonly keep = 200) {}

  enqueue(meta: Pick<QueueJob, 'projectId' | 'user' | 'kind'>, work: JobWork): QueueJob {
    const job: QueueJob = { id: `job-${Date.now().toString(36)}-${(this.counter += 1)}`, ...meta, state: 'queued', createdAt: Date.now() };
    this.jobs.set(job.id, job);
    this.work.set(job.id, work);
    this.pump();
    return { ...job };
  }

  list(projectId?: string): QueueJob[] {
    return [...this.jobs.values()].filter((job) => !projectId || job.projectId === projectId).map((job) => ({ ...job }));
  }

  get(id: string): QueueJob | undefined {
    const job = this.jobs.get(id);
    return job ? { ...job } : undefined;
  }

  /** Отмена: ожидающее снимается сразу, идущее получает сигнал. */
  cancel(id: string): boolean {
    const job = this.jobs.get(id);
    if (!job) return false;
    if (job.state === 'queued') {
      this.finish(job, 'cancelled', 'отменено до запуска');
      return true;
    }
    if (job.state === 'running') {
      this.aborts.get(id)?.abort();
      return true;
    }
    return false;
  }

  private pump(): void {
    for (const job of this.jobs.values()) {
      if (this.running >= this.limit) return;
      if (job.state !== 'queued') continue;
      const work = this.work.get(job.id);
      if (!work) continue;
      this.running += 1;
      job.state = 'running';
      job.startedAt = Date.now();
      const controller = new AbortController();
      this.aborts.set(job.id, controller);
      work(controller.signal)
        .then((result) => this.finish(job, controller.signal.aborted ? 'cancelled' : result.ok ? 'done' : 'failed', result.note))
        .catch((error: unknown) => this.finish(job, controller.signal.aborted ? 'cancelled' : 'failed', error instanceof Error ? error.message : String(error)))
        .finally(() => { this.running -= 1; this.pump(); });
    }
  }

  private finish(job: QueueJob, state: JobState, note?: string): void {
    job.state = state;
    job.finishedAt = Date.now();
    if (note) job.note = note;
    this.work.delete(job.id);
    this.aborts.delete(job.id);
    this.trim();
  }

  /** Старые законченные забываем, чтобы память не росла бесконечно. */
  private trim(): void {
    const finished = [...this.jobs.values()].filter((job) => job.finishedAt);
    for (const job of finished.slice(0, Math.max(0, finished.length - this.keep))) this.jobs.delete(job.id);
  }
}
