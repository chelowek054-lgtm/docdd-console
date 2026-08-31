import { defineEventHandler, readBody } from 'h3';

import { abortSignalOf } from '../../utils/abort';
import { ask } from '../../utils/llm';
import { eventStream } from '../../utils/sse';
import { fail } from '../../utils/http';
import { findProject } from '../../utils/projects';

/**
 * Один запрос к модели через Claude Code. Ответ идёт лентой событий: видно, что
 * модель делает, пока она это делает (docs/04-ui.md). Приложение по-прежнему
 * ничего не применяет — решает человек
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
  const project = await findProject(projectId);
  const stream = eventStream(event);
  const signal = abortSignalOf(event);

  const result = await ask(prompt, {
    ...(project ? { cwd: project.root } : {}),
    signal,
    // Этот запрос спрашивает, а не чинит: до подтверждения человеком в
    // проекте не должно измениться ничего (adr/0010).
    access: 'read',
    onEvent: (modelEvent) => stream.send(modelEvent.kind, modelEvent)
  });

  if (!result.ok) {
    // Заголовки ушли вместе с первым событием — код ответа менять поздно, и
    // причина едет тем же путём, что и всё остальное.
    stream.send('error', { error: { ...result.failure, code: `llm_${result.failure.code}` } });
    stream.close();
    return;
  }

  stream.send('done', { answer: result.answer, ms: result.ms });
  stream.close();
});
