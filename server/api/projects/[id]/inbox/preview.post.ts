import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { fail } from '../../../../utils/http';
import { proposalOf } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * Разбор ответа модели в список записей — до того, как что-то заведено
 * (docs/10-inbox.md). Человек правит список, а не текст ответа.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ answer?: unknown }>(event);
  const answer = typeof body?.answer === 'string' ? body.answer : '';
  if (answer.trim() === '') {
    return fail(event, 400, 'answer_required', 'Пустой ответ разбирать нечего');
  }

  const parsed = proposalOf(answer);

  // Пустой список — это ответ, а не сбой: модель вправе сказать, что заводить
  // нечего, и отказ выдумывать записи ценнее выдуманных записей. Отказываем
  // только когда не сошлась форма.
  if (parsed.records.length === 0 && parsed.problems.length > 0) {
    return fail(event, 422, 'records_invalid', 'Ответ модели не прошёл схему', parsed.problems.join(' '));
  }

  return { records: parsed.records, problems: parsed.problems };
});
