import { defineStore } from 'pinia';
import { computed, reactive } from 'vue';

// Относительные пути, а не алиас Nuxt: хранилище проверяется тестом без Nuxt.
import type { BatchRun } from '../utils/batch-describe';
import { add, readEvents } from '../utils/event-stream';

/**
 * Запросы к модели живут здесь, а не в странице (docs/04-ui.md, «Запрос к модели»;
 * docs/adr/0017-model-jobs-store.md): уход со страницы запрос не обрывает, возврат
 * подхватывает идущее и отдаёт готовое один раз. Оборвать может только человек.
 */

/** Отказ сервера в том виде, как его показывает экран (то же, что `ApiFailure` композабла). */
export interface JobFailure {
  code: string;
  message: string;
  detail?: string;
  blockers?: { code: string; message: string }[];
}

function failureIn(payload: unknown): JobFailure | null {
  const error = (payload as { error?: JobFailure } | null)?.error;
  return error && typeof error.message === 'string' ? error : null;
}

/** Строка ленты: то же, что человек увидел бы в чате модели. */
export interface LogLine {
  kind: 'text' | 'action' | 'result';
  text: string;
  failed?: boolean;
}

export type ModelOutcome =
  | { kind: 'answer'; ms: number }
  | { kind: 'failure'; ms: number; failure: JobFailure }
  | { kind: 'cancelled'; ms: number };

export interface ModelJob {
  key: string;
  /** Что это, по-человечески: строка списка заданий в шапке. */
  label: string;
  /** Страница, где задание начато, — «Открыть» ведёт на неё. */
  to: string;
  running: boolean;
  /** Сколько идёт, в секундах: по счётчику видно, что ожидание живо. */
  elapsed: number;
  outcome: ModelOutcome | null;
  log: LogLine[];
  /** Содержимое события `done`: то, что раньше приходило ответом. */
  answer: unknown;
  /**
   * Страница, начавшая задание, ушла, пока оно шло: ответ некому принять на месте,
   * и его отдаст страница, которая откроется следующей, — один раз.
   */
  orphaned: boolean;
  /** Результат доставлен (на месте или после возврата) либо его не ждали. */
  delivered: boolean;
}

/**
 * Пакетный прогон «Описать пачками» (docs/07-maps.md): цикл живёт в замыкании, а не в
 * странице, поэтому и его состояние — здесь: страница, открытая позже, видит ход прогона.
 */
export interface BatchState {
  running: boolean;
  progress: BatchRun | null;
  finished: BatchRun | null;
  /** Человек нажал «Остановить»: цикл встаёт на ближайшем шаге. */
  stop: boolean;
}

export interface JobMeta {
  label: string;
  to: string;
}

/** Не состояние, а ручки: контроллер и таймер не сериализуются и не должны быть реактивными. */
const handles = new Map<string, { controller: AbortController; ticker: ReturnType<typeof setInterval> }>();

export const useModelJobs = defineStore('modelJobs', () => {
  const jobs = reactive<Record<string, ModelJob>>({});
  const batches = reactive<Record<string, BatchState>>({});

  function batchOf(key: string): BatchState {
    // Возвращаем то, что лежит в реактивном объекте, а не только что созданное: иначе правки мимо реактивности.
    if (!batches[key]) batches[key] = { running: false, progress: null, finished: null, stop: false };
    return batches[key] as BatchState;
  }

  /** Идущие и закончившиеся с неразобранным ответом — то, что показывает шапка. */
  const visible = computed(() => Object.values(jobs).filter((job) => job.running || (!job.delivered && job.orphaned)));
  const runningCount = computed(() => Object.values(jobs).filter((job) => job.running).length
    // Пакетный прогон между шагами не «идёт» в смысле запроса, но работа продолжается.
    || Object.values(batches).filter((batch) => batch.running).length);

  function begin(key: string, meta: JobMeta): AbortSignal {
    // Тот же ключ — новый запрос стирает прошлый итог: старый ответ рядом с новым
    // ожиданием сбивал бы с толку.
    handles.get(key)?.controller.abort();
    stopTicking(key);
    jobs[key] = {
      key, label: meta.label, to: meta.to, running: true, elapsed: 0, outcome: null,
      log: [], answer: null, orphaned: false, delivered: false
    };
    const controller = new AbortController();
    const started = Date.now();
    const ticker = setInterval(() => {
      const job = jobs[key];
      if (job) job.elapsed = Math.round((Date.now() - started) / 1000);
    }, 1000);
    handles.set(key, { controller, ticker });
    return controller.signal;
  }

  function stopTicking(key: string) {
    const handle = handles.get(key);
    if (handle) clearInterval(handle.ticker);
  }

  /** Исход принимает только текущий запрос ключа: прежний, оборванный новым, чужого задания не трогает. */
  function isCurrent(key: string, signal: AbortSignal): boolean {
    return handles.get(key)?.controller.signal === signal;
  }

  function finish(key: string, outcome: ModelOutcome, answer: unknown) {
    const job = jobs[key];
    stopTicking(key);
    handles.delete(key);
    if (!job) return;
    job.running = false;
    job.outcome = outcome;
    job.answer = answer;
    // Начавшая страница ещё здесь — ответ придёт ей на месте; ушла — ждёт возврата.
    job.delivered = !job.orphaned;
  }

  /**
   * Общий ход: запустить, довести до конца, превратить исход в `outcome`. `work`
   * возвращает ответ или отказ; обрыв человеком — не ошибка.
   */
  async function track<T>(
    key: string,
    meta: JobMeta,
    work: (signal: AbortSignal, log: LogLine[]) => Promise<{ answer: T } | { failure: JobFailure }>
  ): Promise<T | null> {
    const signal = begin(key, meta);
    const started = Date.now();
    const job = jobs[key] as ModelJob;
    try {
      const result = await work(signal, job.log);
      if (!isCurrent(key, signal)) return null;
      if ('failure' in result) {
        finish(key, { kind: 'failure', ms: Date.now() - started, failure: result.failure }, null);
        return null;
      }
      finish(key, { kind: 'answer', ms: Date.now() - started }, result.answer);
      return result.answer;
    } catch (error) {
      if (!isCurrent(key, signal)) return null;
      if (signal.aborted) {
        finish(key, { kind: 'cancelled', ms: Date.now() - started }, null);
        return null;
      }
      finish(key, {
        kind: 'failure', ms: Date.now() - started,
        failure: { code: 'network', message: 'Связь с сервером оборвалась', detail: String(error) }
      }, null);
      return null;
    }
  }

  /** Запрос лентой событий: возвращает содержимое события `done`. */
  function stream<T>(key: string, meta: JobMeta, url: string, body: unknown): Promise<T | null> {
    return track<T>(key, meta, async (signal, log) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal
      });
      if (!response.body) throw new Error('сервер не отдал ленту');
      // Отказ до первого события приходит обычным кодом ответа.
      if (!response.headers.get('content-type')?.includes('text/event-stream')) {
        const payload = await response.json();
        const problem = failureIn(payload);
        return problem ? { failure: problem } : { answer: payload as T };
      }

      let done: T | null = null;
      let failure: JobFailure | null = null;
      await readEvents(response.body, (name, payload) => {
        if (name === 'done') { done = payload as T; return; }
        if (name === 'error') { failure = failureIn(payload); return; }
        add(log, name, payload as LogLine);
      });
      return failure ? { failure } : { answer: done as T };
    });
  }

  /** Обычный вызов с ответом одним куском. */
  function run<T>(key: string, meta: JobMeta, call: (signal: AbortSignal) => Promise<T | { error: JobFailure }>): Promise<T | null> {
    return track<T>(key, meta, async (signal) => {
      const response = await call(signal);
      const problem = failureIn(response);
      return problem ? { failure: problem } : { answer: response as T };
    });
  }

  function cancel(key: string) {
    handles.get(key)?.controller.abort();
  }

  /** Страница, начавшая идущее задание, уходит: ответ примет следующая. */
  function orphan(key: string) {
    const job = jobs[key];
    if (job?.running) job.orphaned = true;
  }

  /** Страница вернулась и показала итог — задание закрыто. */
  function acknowledge(key: string) {
    const job = jobs[key];
    if (job && !job.running) job.delivered = true;
  }

  /** Убрать задание из списка: закончившееся и принятое. */
  function drop(key: string) {
    const job = jobs[key];
    if (job && !job.running) delete jobs[key];
  }

  function cancelAll() {
    for (const key of [...handles.keys()]) cancel(key);
  }

  return { jobs, batches, batchOf, visible, runningCount, stream, run, cancel, cancelAll, orphan, acknowledge, drop };
});
