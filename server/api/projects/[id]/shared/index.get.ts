import { defineEventHandler, getRouterParam } from 'h3';

import { normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { sharedSourcesOf } from '../../../../utils/shared-service';
import { findProject, listProjects } from '../../../../utils/projects';

/**
 * Общие практики проекта (docs/11-shared-sources.md). Источник не назван в
 * манифесте — пустой список, а не ошибка: подключать источники не обязан
 * никто.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const root = normalizeRoot(project.root);
    const sources = readWorkspace(root).manifest.sources?.shared ?? [];
    const registered = await listProjects();
    return { sources: sharedSourcesOf(sources, registered) };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'shared_failed', 'Не удалось прочитать общие практики', String(error));
  }
});
