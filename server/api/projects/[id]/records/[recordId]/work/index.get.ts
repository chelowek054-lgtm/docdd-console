import { readFileSync } from 'node:fs';

import { defineEventHandler, getRouterParam } from 'h3';

import { normalizeRoot } from '../../../../../../lib/paths';
import { WorkspaceError } from '../../../../../../lib/workspace';
import { fail } from '../../../../../../utils/http';
import { loadIndex } from '../../../../../../utils/index-service';
import { findProject } from '../../../../../../utils/projects';
import { workState } from '../../../../../../utils/work-service';

/** Состояние работы по задаче: ветка, дифф, круги (docs/09-execution.md). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const root = normalizeRoot(project.root);
    const index = loadIndex(root);
    const record = index.records.find((item) => item.id === recordId);
    if (!record) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }

    const body = readFileSync(`${root}/${record.path}`, 'utf8');
    return workState(root, record, body);
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'read_failed', 'Не удалось прочитать состояние работы', String(error));
  }
});
