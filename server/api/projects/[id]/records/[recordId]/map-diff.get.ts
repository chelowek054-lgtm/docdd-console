import { defineEventHandler, getRouterParam } from 'h3';

import { analyze } from '../../../../../lib/analyze';
import { mapDiffForRecord } from '../../../../../lib/map-diff';
import { OutsideRootError } from '../../../../../lib/paths';
import { readWorkspace, WorkspaceError } from '../../../../../lib/workspace';
import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';

/**
 * Разница карты на схеме (R-0069): «было» — подтверждённые карты до записи, «станет» — вместе с ней.
 * Отдельный от общего `/diff` маршрут: общий несёт текстовую разницу, этот — разметку узлов и связей.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  try {
    const workspace = readWorkspace(project.root);
    const result = analyze({ files: workspace.files, manifest: workspace.manifest, reports: workspace.reports, codeFiles: workspace.codeFiles });
    const diff = mapDiffForRecord(result.records, recordId);
    if (!diff) return fail(event, 404, 'not_a_map', `Запись \`${recordId}\` не найдена или это не карта`);
    return diff;
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'map_diff_failed', 'Не удалось собрать разницу карты', String(error));
  }
});
