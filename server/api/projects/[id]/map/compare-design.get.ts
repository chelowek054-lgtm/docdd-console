import { defineEventHandler, getRouterParam } from 'h3';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { compareProjectDesign } from '../../../../utils/system-design-service';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', 'Проект отсутствует в списке');
  return { differences: compareProjectDesign(project.root) };
});
