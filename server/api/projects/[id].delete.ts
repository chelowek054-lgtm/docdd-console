import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../utils/http';
import { removeProject } from '../../utils/projects';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  // Убирает проект из списка. Файлы не трогает — их ведёт человек и git.
  const removed = await removeProject(id);
  if (!removed) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  return { id, removed: true };
});
