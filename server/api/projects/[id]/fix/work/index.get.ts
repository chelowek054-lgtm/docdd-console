import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { normalizeRoot } from '../../../../../lib/paths';
import { borderOf, fixState } from '../../../../../utils/fix-service';
import { fail } from '../../../../../utils/http';
import { loadIndex } from '../../../../../utils/index-service';
import { findProject } from '../../../../../utils/projects';

/** Состояние починки: что модель тронула и не вышла ли за границу. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const query = getQuery(event);
  const codes = typeof query['codes'] === 'string' && query['codes'] !== '' ? query['codes'].split(',') : [];
  const severity = typeof query['severity'] === 'string' ? query['severity'] : '';

  const root = normalizeRoot(project.root);
  return fixState(root, [...borderOf(loadIndex(root), codes, severity).keys()]);
});
