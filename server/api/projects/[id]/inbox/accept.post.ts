import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError, normalizeRoot } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { acceptNotes } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * «Принять без записей» (docs/10-inbox.md): из заметки заводить нечего, и это решение
 * человека, а не модели. Заметка переезжает в «принятое».
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ notes?: unknown }>(event);
  const notes = Array.isArray(body?.notes) ? body.notes.filter((note): note is string => typeof note === 'string') : [];
  if (notes.length === 0) {
    return fail(event, 400, 'notes_required', 'Не названа ни одна заметка');
  }

  try {
    return acceptNotes(normalizeRoot(project.root), notes);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'accept_failed', 'Не удалось принять заметки', String(error));
  }
});
