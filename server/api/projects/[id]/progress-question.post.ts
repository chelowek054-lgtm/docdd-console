import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { abortSignalOf } from '../../../utils/abort';
import { fail } from '../../../utils/http';
import { loadIndex } from '../../../utils/index-service';
import { ask } from '../../../utils/llm';
import { findProject } from '../../../utils/projects';
import { eventStream } from '../../../utils/sse';

/**
 * Единственный запрос к модели, который доступен наблюдателю (T-0017,
 * docs/15-team-platform.md): вопрос о ходе работы. Модель получает короткую
 * сводку из индекса и вопрос — без инструментов и без доступа к файлам, так что
 * по этому маршруту ничего не прочитать и не изменить сверх сводки.
 */
export default defineEventHandler(async (event) => {
  const project = await findProject(decodeURIComponent(getRouterParam(event, 'id') ?? ''));
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  const body = await readBody<{ question?: unknown }>(event);
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question || question.length > 500) return fail(event, 400, 'question_invalid', 'Вопрос — от 1 до 500 знаков');

  const loaded = loadIndex(project.root);
  const byStatus = new Map<string, number>();
  for (const record of loaded.records.filter((item) => item.type === 'task')) {
    byStatus.set(record.status, (byStatus.get(record.status) ?? 0) + 1);
  }
  const summary = [...byStatus].map(([state, count]) => `${state}: ${count}`).join(', ') || 'задач нет';
  const stream = eventStream(event);
  const result = await ask(
    `Ответь коротко, по-русски, только о ходе работы над проектом «${project.name}». Задачи по статусам: ${summary}. Если вопрос не о ходе работы — скажи, что отвечаешь только на это.\n\nВопрос: ${question}`,
    { signal: abortSignalOf(event), access: 'none', effort: 'low' }
  );
  if (!result.ok) {
    stream.send('error', { error: { ...result.failure, code: `llm_${result.failure.code}` } });
    stream.close();
    return;
  }
  stream.send('done', { answer: result.answer, ms: result.ms });
  stream.close();
});
