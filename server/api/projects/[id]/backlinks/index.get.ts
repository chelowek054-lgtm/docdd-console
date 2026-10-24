import { defineEventHandler, getRouterParam } from 'h3';

import { fail } from '../../../../utils/http';
import { loadIndex } from '../../../../utils/index-service';
import { findProject } from '../../../../utils/projects';

/** Обратные связи отдельно от индекса: в HTML они не нужны, страницы просят их лениво. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    const out: Record<string, unknown> = {};
    for (const record of loadIndex(project.root).records) if (Object.keys(record.backlinks).length) out[record.id] = record.backlinks;
    return { backlinks: out };
  } catch (error) {
    return fail(event, 500, 'read_failed', 'Не удалось собрать обратные связи', String(error));
  }
});
