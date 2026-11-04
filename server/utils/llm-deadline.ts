/**
 * Срок и отмена запроса к провайдеру модели: свой таймер поверх отмены человеком. Один
 * на всех HTTP-провайдеров, чтобы «истёк срок» и «отменили» различались везде одинаково.
 */
export interface Deadline {
  signal: AbortSignal;
  /** Оборвал ли запрос именно срок, а не человек. */
  timedOut(): boolean;
  /** Снять таймер и подписку на отмену — после ответа или ошибки. */
  dispose(): void;
}

export function deadline(timeoutMs: number | undefined, outer: AbortSignal | undefined): Deadline {
  const controller = new AbortController();
  let expired = false;
  const timer = timeoutMs ? setTimeout(() => { expired = true; controller.abort(); }, timeoutMs) : undefined;
  const onAbort = () => controller.abort();
  outer?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => expired,
    dispose: () => {
      clearTimeout(timer);
      outer?.removeEventListener('abort', onAbort);
    }
  };
}
