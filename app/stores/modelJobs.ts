import { defineStore } from 'pinia';
import { computed, reactive, ref, watch } from 'vue';

// Относительные пути, а не алиас Nuxt: хранилище проверяется тестом без Nuxt.
import type { BatchRun } from '../utils/batch-describe';
import { add, readEvents } from '../utils/event-stream';
import { tr } from '../i18n/tr';

/**
 * Запросы к модели живут здесь, а не в странице (docs/04-ui.md, «Запрос к модели»;
 * docs/adr/0017-model-jobs-store.md): уход со страницы запрос не обрывает, возврат
 * подхватывает идущее и отдаёт готовое один раз. Оборвать может только человек.
 *
 * Обновление страницы тоже (ADR-0034): задание идёт на сервере лентой с номером, а
 * хранилище помнит свои задания в `sessionStorage` и после перезагрузки подключается
 * к ленте заново с того места, где остановилось.
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
  /** Номер ленты задания на сервере (событие `feed`): по нему подключаются заново и отменяют. */
  feedId: string | null;
  /** Сколько событий ленты уже принято: с этого места подключаемся после обрыва. */
  seen: number;
  /** Кто ещё сейчас выполняет такой же запрос в этом проекте (событие `peer`). */
  peers: string[];
  startedAt: number;
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

/** Задание в журнале сервера: ответ, ошибка, время, итог. */
export interface ServerJob {
  id: string; kind: string; user: string; state: string; note?: string; answer?: string; ms?: number;
  error?: { code: string; message: string };
}

export interface JobMeta {
  label: string;
  to: string;
}

const STORAGE_KEY = 'docdd.modelJobs';
/** Ответ модели — мнение, а не запись проекта: сутки на вкладку, не дольше (ADR-0034). */
const KEEP_MS = 24 * 60 * 60 * 1000;

/** Проект задания — первая часть ключа (`проект:вид:область`). */
const projectOf = (key: string) => key.split(':')[0] ?? '';

function session(): Storage | null {
  try { return typeof sessionStorage === 'undefined' ? null : sessionStorage; } catch { return null; }
}

/** Не состояние, а ручки: контроллер и таймер не сериализуются и не должны быть реактивными. */
const handles = new Map<string, { controller: AbortController; ticker: ReturnType<typeof setInterval> }>();

export const useModelJobs = defineStore('modelJobs', () => {
  const jobs = reactive<Record<string, ModelJob>>({});
  const batches = reactive<Record<string, BatchState>>({});
  /** Завершённые задания с сервера (журнал .data/llm-jobs): ответ находится и после обновления страницы. */
  const serverJobs = ref<ServerJob[]>([]);

  async function loadServerJobs(projectId: string): Promise<ServerJob[]> {
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/llm/queue`);
      const payload = (await response.json()) as { jobs?: ServerJob[] };
      serverJobs.value = (payload.jobs ?? []).filter((job) => job.state !== 'queued' && job.state !== 'running');
    } catch { /* нет связи — остаётся прежнее */ }
    return serverJobs.value;
  }

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
    const started = Date.now();
    jobs[key] = {
      key, label: meta.label, to: meta.to, running: true, elapsed: 0, outcome: null,
      log: [], answer: null, orphaned: false, delivered: false, feedId: null, seen: 0, peers: [], startedAt: started
    };
    return arm(key, started);
  }

  /** Контроллер и счётчик задания: при начале и при подключении заново после перезагрузки. */
  function arm(key: string, started: number): AbortSignal {
    const controller = new AbortController();
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
    work: (signal: AbortSignal) => Promise<{ answer: T } | { failure: JobFailure }>
  ): Promise<T | null> {
    const signal = begin(key, meta);
    const started = Date.now();
    try {
      const result = await work(signal);
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
        failure: { code: 'network', message: tr('t83.m5.net.lost'), detail: String(error) }
      }, null);
      return null;
    }
  }

  /**
   * Чтение ленты задания: события считаются (`seen`), чтобы после обрыва подключиться с того
   * же места. Лента кончилась без `done`/`error` — связь оборвалась, а задание на сервере идёт:
   * подключаемся к нему заново, пока есть номер ленты (ADR-0034).
   */
  async function consume<T>(key: string, response: Response, signal: AbortSignal): Promise<{ answer: T } | { failure: JobFailure }> {
    const job = jobs[key] as ModelJob;
    let current = response;
    for (let attempt = 0; ; attempt += 1) {
      if (!current.body) throw new Error('сервер не отдал ленту');
      // Отказ до первого события приходит обычным кодом ответа.
      if (!current.headers.get('content-type')?.includes('text/event-stream')) {
        const payload = await current.json();
        const problem = failureIn(payload);
        return problem ? { failure: problem } : { answer: payload as T };
      }
      let done: T | null = null;
      let failure: JobFailure | null = null;
      let ended = false;
      try {
        await readEvents(current.body, (name, payload) => {
          job.seen += 1;
          if (name === 'feed') { job.feedId = (payload as { id?: string }).id ?? null; return; }
          if (name === 'peer') { job.peers = (payload as { users?: string[] }).users ?? []; return; }
          if (name === 'done') { done = payload as T; ended = true; return; }
          if (name === 'error') { failure = failureIn(payload); ended = true; return; }
          add(job.log, name, payload as LogLine);
        });
      } catch (error) {
        if (signal.aborted || !job.feedId || attempt >= 3) throw error;
      }
      if (failure) return { failure };
      if (ended) return { answer: done as T };
      if (signal.aborted || !job.feedId || attempt >= 3) throw new Error('лента оборвалась');
      current = await fetch(feedUrl(key), { signal });
    }
  }

  const feedUrl = (key: string) => {
    const job = jobs[key] as ModelJob;
    return `/api/projects/${encodeURIComponent(projectOf(key))}/llm/feeds/${encodeURIComponent(job.feedId ?? '')}?from=${job.seen}`;
  };

  /** Запрос лентой событий: возвращает содержимое события `done`. */
  function stream<T>(key: string, meta: JobMeta, url: string, body: unknown): Promise<T | null> {
    return track<T>(key, meta, async (signal) => {
      const response = await fetch(url, {
        method: 'POST',
        // Ключ задания: тот же человек с тем же ключом снимает прежнее, другие видят «такой же запрос идёт».
        headers: { 'Content-Type': 'application/json', 'X-Model-Job-Key': key },
        body: JSON.stringify(body),
        signal
      });
      return consume<T>(key, response, signal);
    });
  }

  /**
   * Подключиться к идущему заданию после перезагрузки: состояние уже восстановлено из
   * `sessionStorage`, здесь — только чтение ленты с места `seen` и итог.
   */
  async function reattach(key: string): Promise<void> {
    const job = jobs[key];
    if (!job?.running || !job.feedId) return;
    const signal = arm(key, job.startedAt);
    try {
      const response = await fetch(feedUrl(key), { signal });
      if (response.status === 404) {
        finish(key, { kind: 'failure', ms: Date.now() - job.startedAt, failure: { code: 'feed_gone', message: tr('t83.m8.gone') } }, null);
        return;
      }
      const result = await consume<unknown>(key, response, signal);
      if (!isCurrent(key, signal)) return;
      if ('failure' in result) finish(key, { kind: 'failure', ms: Date.now() - job.startedAt, failure: result.failure }, null);
      else finish(key, { kind: 'answer', ms: Date.now() - job.startedAt }, result.answer);
    } catch (error) {
      if (!isCurrent(key, signal)) return;
      finish(key, signal.aborted
        ? { kind: 'cancelled', ms: Date.now() - job.startedAt }
        : { kind: 'failure', ms: Date.now() - job.startedAt, failure: { code: 'network', message: tr('t83.m5.net.lost'), detail: String(error) } }, null);
    }
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
    const feedId = jobs[key]?.feedId;
    // Закрытие соединения задание не снимает (ADR-0034): отмена — отдельным запросом.
    if (feedId && jobs[key]?.running) {
      void fetch(`/api/projects/${encodeURIComponent(projectOf(key))}/llm/feeds/${encodeURIComponent(feedId)}`, { method: 'DELETE' }).catch(() => {});
    }
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

  /** Задания вкладки — в `sessionStorage`: переживают обновление страницы, не переживают закрытия вкладки. */
  let saving: ReturnType<typeof setTimeout> | null = null;
  function save() {
    const store = session();
    if (!store) return;
    if (saving) return;
    // Лента растёт по кусочку текста: пишем не чаще раза в полсекунды.
    saving = setTimeout(() => {
      saving = null;
      try { store.setItem(STORAGE_KEY, JSON.stringify({ at: Date.now(), jobs: Object.values(jobs) })); } catch { /* полно или закрыто — живём в памяти */ }
    }, 500);
  }
  watch(jobs, save, { deep: true });

  /** После перезагрузки: вернуть задания вкладки и подключиться к идущим. Страница их уже не ждёт — ответ примет следующая. */
  function restore(now = Date.now()) {
    const store = session();
    if (!store) return;
    type Saved = { at?: number; jobs?: ModelJob[] } | null;
    let saved: Saved;
    try { saved = JSON.parse(store.getItem(STORAGE_KEY) ?? 'null') as Saved; } catch { saved = null; }
    if (!saved?.jobs || !saved.at || now - saved.at > KEEP_MS) return;
    for (const job of saved.jobs) {
      if (jobs[job.key] || now - (job.startedAt ?? 0) > KEEP_MS) continue;
      // Без номера ленты подключаться не к чему: запрос ушёл, но первое событие не пришло.
      if (job.running && !job.feedId) {
        jobs[job.key] = { ...job, running: false, orphaned: true, delivered: false, outcome: { kind: 'failure', ms: now - job.startedAt, failure: { code: 'feed_gone', message: tr('t83.m8.gone') } } };
        continue;
      }
      jobs[job.key] = { ...job, orphaned: job.running || job.orphaned };
      if (job.running) void reattach(job.key);
    }
  }

  return { jobs, serverJobs, loadServerJobs, batches, batchOf, visible, runningCount, stream, run, cancel, cancelAll, orphan, acknowledge, drop, restore };
});
