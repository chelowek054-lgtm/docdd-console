import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { semanticSearch } from '../../../../utils/semantic-service';

/** Смысловой поиск (docs/adr/0031-semantic-search.md): пустой запрос — пустой ответ, без работы. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const query = getQuery(event);
  const q = typeof query['q'] === 'string' ? query['q'].trim() : '';
  if (!q) return { hits: [], model: null, blocks: 0 };
  const limit = Math.min(50, Math.max(1, Number(query['limit']) || 10));
  try {
    const result = await semanticSearch(project.root, q.slice(0, 500), limit);
    const base = `/projects/${id}`;
    return {
      ...result,
      hits: result.hits.map((hit) => ({
        ...hit,
        to: hit.type === 'note' ? `${base}/fill?tab=inbox` : `${base}/records/${hit.recordId}${hit.anchor ? `#${hit.anchor}` : ''}`
      }))
    };
  } catch (error) {
    return fail(event, 500, 'search_failed', 'Поиск не удался', String(error));
  }
});
