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
  /** Ответ модели и итог хранятся вместе с заданием: после обновления страницы ответ находят по id (R-0010). */
  answer?: string;
  error?: { code: string; message: string };
  ms?: number;
  /** Запуск сервера, в котором задание создано: незавершённое из прошлого запуска — «прервано перезапуском». */
  boot?: string;
}

export interface JobOutcome { ok: boolean; note?: string; answer?: string; error?: { code: string; message: string }; ms?: number }
export type JobWork = (signal: AbortSignal) => Promise<JobOutcome>;

/** Незавершённое с чужим запуском сервера не может идти: помечаем и оставляем в журнале. Чистая функция. */
export function markInterrupted(jobs: readonly QueueJob[], boot: string, now = Date.now()): QueueJob[] {
  return jobs.map((job) => (job.state === 'queued' || job.state === 'running') && job.boot !== boot
    ? { ...job, state: 'failed' as const, finishedAt: now, note: 'прервано перезапуском', error: { code: 'interrupted', message: 'прервано перезапуском' } }
    : job);
}

/** Журнал хранит последние `keep` заданий по времени создания. */
export function trimJobs<T extends { createdAt: number }>(jobs: readonly T[], keep = 200): T[] {
  return [...jobs].sort((a, b) => a.createdAt - b.createdAt).slice(-keep);
}

export class LlmQueue {
  private readonly jobs = new Map<string, QueueJob>();
  private readonly work = new Map<string, JobWork>();
  private readonly aborts = new Map<string, AbortController>();
  private running = 0;
  private counter = 0;

  /** `limit` — предел параллельности: модель и лимиты у людей общие. */
  constructor(
    private readonly limit = 2,
    private readonly keep = 200,
    /** Вызывается при каждой смене состояния: сюда подключается файл-журнал. */
    private readonly onChange?: (job: QueueJob) => void,
    private readonly boot?: string
  ) {}

  enqueue(meta: Pick<QueueJob, 'projectId' | 'user' | 'kind'>, work: JobWork): QueueJob {
    const job: QueueJob = { id: `job-${Date.now().toString(36)}-${(this.counter += 1)}`, ...meta, state: 'queued', createdAt: Date.now(), ...(this.boot ? { boot: this.boot } : {}) };
    this.jobs.set(job.id, job);
    this.notify(job);
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
      this.notify(job);
      const controller = new AbortController();
      this.aborts.set(job.id, controller);
      work(controller.signal)
        .then((result) => this.finish(job, controller.signal.aborted ? 'cancelled' : result.ok ? 'done' : 'failed', result.note, result))
        .catch((error: unknown) => this.finish(job, controller.signal.aborted ? 'cancelled' : 'failed', error instanceof Error ? error.message : String(error)))
        .finally(() => { this.running -= 1; this.pump(); });
    }
  }

  private notify(job: QueueJob): void {
    try { this.onChange?.({ ...job }); } catch { /* журнал не должен ронять очередь */ }
  }

  private finish(job: QueueJob, state: JobState, note?: string, outcome?: JobOutcome): void {
    job.state = state;
    job.finishedAt = Date.now();
    if (note) job.note = note;
    if (outcome?.answer !== undefined) job.answer = outcome.answer;
    if (outcome?.error) job.error = outcome.error;
    if (outcome?.ms !== undefined) job.ms = outcome.ms;
    this.notify(job);
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
