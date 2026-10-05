import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { parseArchitectureAudit } from '../../../lib/architecture';
import { OutsideRootError, normalizeRoot } from '../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../lib/workspace';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

/**
 * Разбор ответа на запрос `architecture` (docs/07-maps.md, «Аудит моделью»).
 * Ничего не пишет: достаёт находки из блока `docdd-architecture` и отбрасывает
 * то, чего нет в проекте, называя причину. Находки — мнение: в задачи их
 * превращает человек.
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
    const result = parseArchitectureAudit(answer, readWorkspace(normalizeRoot(project.root)).codeFiles);
    if (!result) {
      return fail(event, 422, 'architecture_unparsed', 'В ответе нет блока `docdd-architecture` с находками — показываю его текстом');
    }
    return result;
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'architecture_failed', 'Не удалось разобрать ответ', String(error));
  }
});
