import type { ProviderFailure, ProviderResult } from '../lib/llm-provider';

/** Общее для чат-провайдеров: статус HTTP и сбои сети — в общие коды отказов. */
export function failureOf(error: unknown, status: number | undefined, signal: AbortSignal | undefined, timedOut: boolean): ProviderFailure {
  if (signal?.aborted) return { code: 'cancelled', message: 'Запрос отменён' };
  if (timedOut) return { code: 'timeout', message: 'Провайдер не ответил за отведённое время' };
  if (status === 401 || status === 403) return { code: 'unauthorized', message: 'Провайдер отклонил ключ. Проверьте ключ и права на экране «Модели».' };
  if (status !== undefined) return { code: 'failed', message: `Провайдер ответил кодом ${status}` };
  const detail = error instanceof Error ? error.message : String(error);
  return { code: 'unavailable', message: 'Не удалось связаться с провайдером', detail };
}

/** Читает поток server-sent events построчно: только содержимое `data:`. */
export async function* sseData(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let at = buffer.indexOf('\n');
    while (at >= 0) {
      const line = buffer.slice(0, at).replace(/\r$/, '');
      buffer = buffer.slice(at + 1);
      if (line.startsWith('data:')) yield line.slice(5).trim();
      at = buffer.indexOf('\n');
    }
  }
}

export function emptyFailure(): ProviderResult {
  return { ok: false, failure: { code: 'empty', message: 'Модель вернула пустой ответ' } };
}
