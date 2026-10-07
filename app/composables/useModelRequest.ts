import type { ApiFailure } from '~/composables/useProjectIndex';
import { useModelJobs, type JobMeta } from '~/stores/modelJobs';

export type { LogLine, ModelOutcome } from '~/stores/modelJobs';

/**
 * Ожидание ответа модели (docs/04-ui.md, раздел «Запрос к модели»). Модель
 * думает минутами, и всё это время экран обязан отвечать на один вопрос: идёт
 * запрос или отвалился. Счётчик, срок и отмена — одни на все места, откуда зовут
 * модель.
 *
 * Состояние живёт в общем хранилище заданий (`stores/modelJobs.ts`, ADR-0017), а
 * здесь — привязка страницы к своему заданию по ключу. Уход со страницы запрос не
 * обрывает; страница, открытая позже, видит идущее и принимает готовое.
 */
export interface ModelRequestOptions {
  /** Что это, по-человечески: строка в общем списке заданий. */
  label: string;
  /**
   * Ответ пришёл, пока страницы не было, а её следующий экземпляр открылся. Зовётся
   * один раз и делает то же, что страница делает с ответом на месте.
   */
  onRecovered?: (answer: unknown) => void;
}

export function useModelRequest(key: MaybeRefOrGetter<string>, options: ModelRequestOptions) {
  const store = useModelJobs();
  const route = useRoute();
  const jobKey = computed(() => toValue(key));
  const job = computed(() => store.jobs[jobKey.value]);

  /** Этот экземпляр начал задание — только его продолжение ждёт ответ на месте. */
  let started = false;
  const meta = (): JobMeta => ({ label: options.label, to: route.fullPath });

  const running = computed(() => job.value?.running ?? false);
  const elapsed = computed(() => job.value?.elapsed ?? 0);
  const outcome = computed(() => job.value?.outcome ?? null);
  const log = computed(() => job.value?.log ?? []);

  /** Ответ, пришедший без нас: принимаем один раз; итог без ответа (отказ, отмена) только показывается. */
  function recover() {
    const current = job.value;
    if (!current || current.running || !current.orphaned || current.delivered) return;
    const answer = current.answer;
    store.acknowledge(jobKey.value);
    if (answer !== null && answer !== undefined) options.onRecovered?.(answer);
  }
  // После монтирования, а не сразу: обработчик страницы замыкает её состояние, которое в setup ещё не объявлено.
  onMounted(recover);
  watch(() => job.value && !job.value.running && job.value.orphaned && !job.value.delivered, (ready) => { if (ready) recover(); });

  onBeforeUnmount(() => {
    const current = job.value;
    if (!current) return;
    // Идёт — продолжает идти, а ответ примет следующая страница; кончилось и принято — убираем след.
    if (current.running && started) store.orphan(jobKey.value);
    else if (!current.running && current.delivered) store.drop(jobKey.value);
  });

  /**
   * Запрос лентой событий: возвращает ответ, если страница дождалась его, иначе `null` —
   * тогда ответ примет `onRecovered` следующей страницы. `background` — для цикла, который
   * живёт дольше страницы (пакетный прогон): ответ нужен ему самому, страницы не ждём.
   */
  async function stream<T>(url: string, body: unknown, settings: { background?: boolean } = {}): Promise<T | null> {
    started = true;
    const answer = await store.stream<T>(jobKey.value, meta(), url, body);
    if (settings.background) {
      store.acknowledge(jobKey.value);
      return answer;
    }
    return store.jobs[jobKey.value]?.orphaned ? null : answer;
  }

  async function run<T>(call: (signal: AbortSignal) => Promise<T | { error: ApiFailure }>): Promise<T | null> {
    started = true;
    const answer = await store.run<T>(jobKey.value, meta(), call);
    return store.jobs[jobKey.value]?.orphaned ? null : answer;
  }

  function cancel() {
    store.cancel(jobKey.value);
  }

  return { running, elapsed, outcome, log, run, stream, cancel };
}
