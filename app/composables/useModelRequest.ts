import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * Ожидание ответа модели (docs/04-ui.md, раздел «Запрос к модели»). Модель
 * думает минутами, и всё это время экран обязан отвечать на один вопрос: идёт
 * запрос или отвалился. Отсюда счётчик, срок и отмена — одни на все места,
 * откуда зовут модель.
 */

export type ModelOutcome =
  | { kind: 'answer'; ms: number }
  | { kind: 'failure'; ms: number; failure: ApiFailure }
  | { kind: 'cancelled'; ms: number };

export function useModelRequest() {
  const running = ref(false);
  /** Сколько идёт запрос, в секундах: по этому счётчику видно, что ожидание живо. */
  const elapsed = ref(0);
  const outcome = ref<ModelOutcome | null>(null);

  let controller: AbortController | null = null;
  let ticker: ReturnType<typeof setInterval> | null = null;

  function stopTicking() {
    if (ticker) clearInterval(ticker);
    ticker = null;
  }

  /**
   * Запускает вызов и ведёт его до конца. Возвращает ответ или `null`, если
   * запрос не удался: разбирать неудачу вызывающему не нужно — она уже в
   * `outcome` и на экране.
   */
  async function run<T>(call: (signal: AbortSignal) => Promise<T | { error: ApiFailure }>): Promise<T | null> {
    // Новый запрос стирает прошлый итог, и это видно: старый ответ рядом с
    // новым ожиданием сбивал бы с толку.
    outcome.value = null;
    running.value = true;
    elapsed.value = 0;
    controller = new AbortController();

    const started = Date.now();
    ticker = setInterval(() => {
      elapsed.value = Math.round((Date.now() - started) / 1000);
    }, 1000);

    try {
      const response = await call(controller.signal);
      const problem = failureOf(response);
      if (problem) {
        outcome.value = { kind: 'failure', ms: Date.now() - started, failure: problem };
        return null;
      }
      outcome.value = { kind: 'answer', ms: Date.now() - started };
      return response as T;
    } catch (error) {
      // Отмена — не ошибка: человек передумал ждать.
      if (controller.signal.aborted) {
        outcome.value = { kind: 'cancelled', ms: Date.now() - started };
        return null;
      }
      outcome.value = {
        kind: 'failure',
        ms: Date.now() - started,
        failure: { code: 'network', message: 'Связь с сервером оборвалась', detail: String(error) }
      };
      return null;
    } finally {
      stopTicking();
      running.value = false;
      controller = null;
    }
  }

  function cancel() {
    controller?.abort();
  }

  onScopeDispose(() => {
    stopTicking();
    controller?.abort();
  });

  return { running, elapsed, outcome, run, cancel };
}
