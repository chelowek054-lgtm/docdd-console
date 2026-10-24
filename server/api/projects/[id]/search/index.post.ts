import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { ensureIndex, resetIndex } from '../../../../utils/semantic-service';

/**
 * Состояние индекса смыслового поиска и пересборка (окно «Настройки» → «Поиск»).
 * `{ rebuild: true }` выбрасывает кэш и строит заново; иначе — досчитывает изменённое.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = (await readBody(event).catch(() => null)) as { rebuild?: unknown } | null;
  try {
    if (body?.rebuild === true) resetIndex(project.root);
    const started = Date.now();
    const state = await ensureIndex(project.root);
    return { ...state, ms: Date.now() - started };
  } catch (error) {
    return fail(event, 500, 'index_failed', 'Индекс не собран', String(error));
  }
});
