import { defineEventHandler, getRouterParam } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';
import { rebuildReferenceIndex } from '../../../../utils/reference-service';

/** «Обновить индекс»: собирает INDEX.md из справок и карты кода и пишет файл (docs/13-reference.md). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const report = rebuildReferenceIndex(project.root);
    if (!report) {
      return fail(event, 422, 'reference_disabled', 'В манифесте нет paths.reference: справочника в проекте нет');
    }
    return report;
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'reference_failed', 'Не удалось собрать индекс', String(error));
  }
});
