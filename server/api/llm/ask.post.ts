import { defineEventHandler, readBody } from 'h3';

import { ask } from '../../utils/llm';
import { fail } from '../../utils/http';

/**
 * Один запрос к модели через Claude Code. Приложение ничего не применяет:
 * ответ возвращается экрану, решает человек
 * (docs/adr/0008-llm-through-claude-code.md).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ prompt?: unknown }>(event);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';

  if (!prompt) {
    return fail(event, 400, 'prompt_required', 'Пустой запрос отправлять незачем');
  }
  if (prompt.length > 500_000) {
    return fail(event, 400, 'prompt_too_large', 'Запрос больше 500 000 знаков: сузьте фильтр на экране');
  }

  const result = await ask(prompt);
  if (!result.ok) {
    const status = result.failure.code === 'unavailable' ? 503 : 502;
    return fail(event, status, `llm_${result.failure.code}`, result.failure.message, result.failure.detail);
  }
  return { answer: result.answer, ms: result.ms };
});
