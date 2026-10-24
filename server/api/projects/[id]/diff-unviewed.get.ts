import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';
import { unviewedReview } from '../../../utils/record-diff-service';

/** Записи на подтверждении, чью разницу не открывали: по ним список рисует значок. */
export default defineEventHandler(async (event) => {
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден в списке');
  return { ids: unviewedReview(project.root) };
});
