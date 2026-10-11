import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { parseFindings } from '../../../../../lib/design-screens';
import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { projectScreens } from '../../../../../utils/design-screens-service';
import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';

/**
 * Разбор ответа модели в находки проверки экранов (docs/16-design-system.md).
 * Ничего не пишет: находка про экран, ширину или тему, которых нет в описи,
 * отбрасывается и называется в `problems`.
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
    return fail(event, 400, 'answer_required', 'Нечего разбирать: ответа модели нет');
  }

  try {
    return parseFindings(answer, projectScreens(project.root));
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'design_findings_failed', 'Не удалось разобрать находки', String(error));
  }
});
