import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../../../lib/paths';
import { fail } from '../../../../../../utils/http';
import { findProject } from '../../../../../../utils/projects';
import { recordDiff } from '../../../../../../utils/record-diff-service';

/** «Что меняется» по типу записи (docs/03-server-api.md). Чтение: отметку просмотра ставит POST. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    const diff = await recordDiff(project.root, recordId);
    if (!diff) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    return diff;
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'diff_failed', 'Не удалось построить разницу', String(error));
  }
});
