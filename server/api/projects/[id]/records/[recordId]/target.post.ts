import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyTarget } from '../../../../../lib/manager';
import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail, failWith } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { openRecord, saveRecord } from '../../../../../utils/record-write';

/**
 * Целевая дата фазы (T-0034): одно поле front matter, ни оценок задач, ни тела.
 * Пустая дата убирает веху.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = await readBody<{ target?: unknown }>(event);
  const target = typeof body?.target === 'string' && body.target.trim() !== '' ? body.target.trim() : null;
  try {
    const context = openRecord(project.root, recordId);
    if (!context) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    if (context.record.type !== 'phase') return fail(event, 400, 'target_not_phase', 'Целевая дата ставится только фазе');
    const outcome = applyTarget(context.original, target);
    if (outcome.problems.length > 0) return fail(event, 400, 'target_invalid', outcome.problems.join(' '));
    const saved = saveRecord(context, outcome, project.root);
    if (!saved.ok) return failWith(event, 422, 'write_refused', 'Запись отменена', saved.problems.map((message) => ({ code: 'guard', message })));
    return { record: saved.record };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'write_failed', 'Не удалось записать изменение', String(error));
  }
});
