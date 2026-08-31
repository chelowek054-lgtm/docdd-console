import { defineEventHandler, readBody } from 'h3';

import { ask } from '../../utils/llm';
import { fail } from '../../utils/http';
import { findProject } from '../../utils/projects';

/**
 * Один запрос к модели через Claude Code. Приложение ничего не применяет:
 * ответ возвращается экрану, решает человек
 * (docs/adr/0008-llm-through-claude-code.md).
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ prompt?: unknown; projectId?: unknown }>(event);
  const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : '';
  const projectId = typeof body?.projectId === 'string' ? body.projectId : '';

  if (!prompt) {
    return fail(event, 400, 'prompt_required', 'Пустой запрос отправлять незачем');
  }
  if (prompt.length > 500_000) {
    return fail(event, 400, 'prompt_too_large', 'Запрос больше 500 000 знаков: сузьте фильтр на экране');
  }

  // Модель работает в корне проекта, а не в папке сервера: иначе она разберёт
  // не тот код. Путь берётся из списка проектов, а не из запроса браузера.
  const project = projectId ? await findProject(projectId) : null;
  const result = await ask(prompt, project ? { cwd: project.root } : {});
  if (!result.ok) {
    // Нет программы и отказ в доступе — разные беды, и чинятся по-разному.
    const status = result.failure.code === 'unavailable' || result.failure.code === 'unauthorized' ? 503 : 502;
    return fail(event, status, `llm_${result.failure.code}`, result.failure.message, result.failure.detail);
  }
  return { answer: result.answer, ms: result.ms };
});
