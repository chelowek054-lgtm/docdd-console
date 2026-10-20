import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { designDiffForRecord } from '../../../../utils/design-diff-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Разница токенов дизайна у записи на подтверждении: `?record=D-0007` (R-0073). Ничего не пишет. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  const record = String(getQuery(event)['record'] ?? '');
  if (record === '') return fail(event, 400, 'record_required', 'Нужен номер записи: ?record=…');
  try {
    const diff = designDiffForRecord(project.root, record);
    return diff ?? fail(event, 404, 'not_a_design_record', `Запись \`${record}\` не найдена или не про дизайн`);
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'design_diff_failed', 'Не удалось собрать разницу токенов', String(error));
  }
});
