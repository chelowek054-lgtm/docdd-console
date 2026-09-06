import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { createNote } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * Заметка от человека без markdown и файловой системы — та же дверь на склад,
 * что и у модели (docs/10-inbox.md, «Что кладёт человек»).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ title?: unknown; body?: unknown }>(event);
  const title = typeof body?.title === 'string' ? body.title : '';
  const text = typeof body?.body === 'string' ? body.body : '';

  try {
    const outcome = createNote(project.root, { title, body: text });
    if (!outcome.ok) {
      return fail(event, 400, outcome.code, outcome.message);
    }
    return { path: outcome.path };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'note_failed', 'Не удалось сохранить заметку', String(error));
  }
});
