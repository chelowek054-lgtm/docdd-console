import { defineEventHandler } from 'h3';

import { ASK_TIMEOUT, WORK_TIMEOUT, availability } from '../../utils/llm';

/** Есть ли чем спросить модель. Отсутствие Claude Code — состояние, а не ошибка. */
export default defineEventHandler(() => {
  const found = availability();
  return {
    available: found.available,
    // Путь наружу не отдаём: экрану нужно знать «можно или нет» и почему.
    reason: found.reason ?? null,
    // Сроки нужны экрану, чтобы честно сказать, сколько ждать и когда отменит.
    timeouts: { ask: ASK_TIMEOUT, work: WORK_TIMEOUT }
  };
});
