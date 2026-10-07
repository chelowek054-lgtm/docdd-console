import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { parsePriority } from '../../../../lib/work-order';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';

/**
 * Разбор ответа модели в порядок — до того, как что-то записано (docs/04-ui.md,
 * «Порядок по важности»). Неизвестное отброшено, пропущенное достроено, зависимости
 * восстановлены; обо всём этом сказано в `problems` и `fixed`.
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
    return fail(event, 400, 'answer_required', 'Нечего разбирать: ответа нет');
  }

  try {
    const parsed = parsePriority(answer, loadIndex(project.root).records);
    if (!parsed) {
      return fail(event, 422, 'priority_unparsed', 'В ответе нет блока `docdd-order` с порядком — показываю его текстом');
    }
    return { phases: parsed.plan.phases, problems: parsed.problems, fixed: parsed.fixed };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'priority_failed', 'Не удалось разобрать ответ', String(error));
  }
});
