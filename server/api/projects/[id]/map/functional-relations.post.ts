import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { parseFunctionalRelations } from '../../../../lib/functional';
import { OutsideRootError, normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildProjectMap } from '../../../../utils/map-service';
import { findProject } from '../../../../utils/projects';

/**
 * Разбор ответа на запрос `relations` (docs/07-maps.md, «Связи — тоже пачкой, и
 * модель может их предложить»). Ничего не пишет: достаёт предложения и
 * сопоставляет их с картиной — что новое, что пропущено и почему. Дальше решает
 * человек, а сохраняет он обычной пачкой связей (`map/capability`,
 * `action: "relations"`).
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
    const { capabilities, relations } = buildProjectMap(normalizeRoot(project.root)).functional;
    const result = parseFunctionalRelations(answer, capabilities, relations);
    if (!result) {
      return fail(
        event,
        422,
        'functional_relations_unparsed',
        'В ответе нет блока \`docdd-functional-relations\` со связями — показываю его текстом'
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
    return fail(event, 500, 'functional_relations_failed', 'Не удалось разобрать ответ', String(error));
  }
});
