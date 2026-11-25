import { defineEventHandler, getQuery, getRouterParam, setHeader } from 'h3';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { buildMapContext } from '../../../../utils/map-context';
import { findProject } from '../../../../utils/projects';

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  const { map, offset, limit, group } = getQuery(event);
  const number = (value: unknown) => typeof value === 'string' && /^\d{1,9}$/.test(value) ? Number(value) : undefined;
  try {
    const context = buildMapContext(project.root, id, typeof map === 'string' ? map : 'functional', {
      ...(number(offset) !== undefined ? { offset: number(offset)! } : {}),
      ...(number(limit) !== undefined ? { limit: number(limit)! } : {}),
      ...(typeof group === 'string' && group ? { group } : {})
    });
    if (!context) return fail(event, 404, 'map_not_found', 'Карта не найдена. Укажите вид карты или custom:<id>');
    setHeader(event, 'Cache-Control', 'no-store');
    return context;
  } catch (error) {
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'map_context_failed', 'Не удалось собрать контекст карты');
  }
});
