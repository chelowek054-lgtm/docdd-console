import { defineEventHandler, getRouterParam, setHeader } from 'h3';

import { priorityState } from '../../../../lib/project-chat/priority';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

export default defineEventHandler(async (event) => {
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  setHeader(event, 'Cache-Control', 'no-store');
  return priorityState(project.root);
});
