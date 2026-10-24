import { existsSync, readFileSync } from 'node:fs';

import { defineEventHandler, getRouterParam } from 'h3';

import { discussionPath, emptyDiscussion, parseDiscussion } from '../../../../../lib/discussion';
import { OutsideRootError, resolveInside } from '../../../../../lib/paths';
import { fail } from '../../../../../utils/http';
import { loadIndex } from '../../../../../utils/index-service';
import { findProject } from '../../../../../utils/projects';

/** Обсуждение записи; файла нет — пустое. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    const record = loadIndex(project.root).records.find((item) => item.id === recordId);
    if (!record) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    const file = resolveInside(project.root, discussionPath(record.path));
    return existsSync(file) ? parseDiscussion(readFileSync(file, 'utf8')) : emptyDiscussion();
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    return fail(event, 500, 'read_failed', 'Не удалось прочитать обсуждение', String(error));
  }
});
