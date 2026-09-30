import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { parseProposal } from '../../../../lib/inbox';
import { planPhases } from '../../../../lib/phase-plan';
import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';

/**
 * Ответ модели — в список фаз, до того как что-то заведено
 * (docs/03-server-api.md, «Фазы»). Человек правит список, а не текст ответа.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ answer?: unknown; tasks?: unknown }>(event);
  const answer = typeof body?.answer === 'string' ? body.answer : '';
  if (answer.trim() === '') {
    return fail(event, 400, 'answer_required', 'Пустой ответ разбирать нечего');
  }
  const scope = Array.isArray(body?.tasks)
    ? body.tasks.filter((task): task is string => typeof task === 'string')
    : [];

  const parsed = parseProposal(answer);
  // Пустой список с пояснением модели — ответ, а не сбой; отказ — только форме.
  if (parsed.records.length === 0 && parsed.problems.length > 0) {
    return fail(event, 422, 'records_invalid', 'Ответ модели не прошёл схему', parsed.problems.join(' '));
  }

  const plan = planPhases(parsed.records, loadIndex(project.root).records, scope);
  return { ...plan, problems: [...parsed.problems, ...plan.problems] };
});
