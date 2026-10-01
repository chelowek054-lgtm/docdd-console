import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { parseFunctionalCheck } from '../../../../lib/functional';
import { OutsideRootError, normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildProjectMap } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';

/**
 * Разбор ответа на запрос `functional-check` (docs/07-maps.md, «Ответ
 * „Проверить по коду“»). Ничего не пишет: достаёт предложения модели и
 * сопоставляет их с картиной — что сейчас, что предлагается. Дальше решает
 * человек, а сохраняет он обычной пачкой отметок (`map/capability`,
 * `action: "status"`).
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
    const capabilities = buildProjectMap(normalizeRoot(project.root)).functional.capabilities;
    const result = parseFunctionalCheck(answer, capabilities);
    if (!result) {
      return fail(
        event,
        422,
        'functional_check_unparsed',
        'В ответе нет блока `docdd-functional-check` с предложениями — показываю его текстом'
      );
    }
    return result;
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'functional_check_failed', 'Не удалось разобрать ответ', String(error));
  }
});
