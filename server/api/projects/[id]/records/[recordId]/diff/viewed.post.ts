import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../../../../utils/http';
import { loadIndex } from '../../../../../../utils/index-service';
import { findProject } from '../../../../../../utils/projects';
import { markViewed } from '../../../../../../utils/record-diff-service';

/** Разницу открыли: подтверждение после этого пишет в журнал «после просмотра разницы». */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const record = loadIndex(project.root).records.find((item) => item.id === recordId);
  if (!record) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
  markViewed(project.root, recordId, record.path);
  return { viewed: true };
});
