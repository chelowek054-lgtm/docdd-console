import { defineEventHandler, getRouterParam, setHeader } from 'h3';

import { OutsideRootError } from '../../../lib/paths';
import { readProjectGit } from '../../../lib/project-git';
import { fail } from '../../../utils/http';
import { findProject } from '../../../utils/projects';

export default defineEventHandler(async (event) => {
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  setHeader(event, 'Cache-Control', 'no-store');
  try {
    return await readProjectGit(project.root);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', 'Служебные файлы Git находятся за пределами проекта');
    }
    return fail(event, 500, 'git_read_failed', 'Не удалось прочитать ветки Git');
  }
});
