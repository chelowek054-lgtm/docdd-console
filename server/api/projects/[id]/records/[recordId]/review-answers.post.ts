import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { reworkText, usableAnswers } from '../../../../../lib/review-questions';
import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { saveReviewAnswers } from '../../../../../utils/review-questions-service';

/**
 * Ответы человека на вопросы проверки (R-0117). Статус задачи не меняется, а агент на своей задаче
 * сюда не попадает: отказ стоит в `agentVerdict`.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ answers?: unknown; actor?: unknown }>(event);
  const answers = usableAnswers(body?.answers);
  const saved = saveReviewAnswers(project.root, recordId, answers, typeof body?.actor === 'string' ? body.actor : '');
  if (!saved.ok) return fail(event, saved.status, saved.code, saved.message);
  return { summary: saved.summary, rework: reworkText(answers) };
});
