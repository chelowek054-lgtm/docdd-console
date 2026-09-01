import { defineEventHandler, getRouterParam } from 'h3';

import { normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError, readWorkspace } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { inboxNotes } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * Что лежит во входящем (docs/10-inbox.md). Склад не назван в манифесте —
 * отвечаем об этом прямо: экрана входящего у такого проекта нет.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  try {
    const root = normalizeRoot(project.root);
    const folders = readWorkspace(root).manifest.sources?.inbox ?? [];

    return {
      folders,
      // Текст заметок наружу не отдаём: экрану нужен список, а не содержимое.
      notes: inboxNotes(root).map((note) => ({ path: note.path, title: note.title, size: note.text.length }))
    };
  } catch (error) {
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'inbox_failed', 'Не удалось прочитать входящее', String(error));
  }
});
