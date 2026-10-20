import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { confluenceNotes, jiraNotes, parseJira, type ConfluencePage, type ExternalNote } from '../../../../lib/external-import';
import { OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail } from '../../../../utils/http';
import { createNote } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * Импорт выгрузок Jira (T-0047) и Confluence (T-0048) во входящее. Тело:
 * `{ source: 'jira', text }` или `{ source: 'confluence', pages: [{ title, parent, body }] }`.
 * Заметки ложатся на склад той же дверью, что и заметка человека; записи из них
 * заводятся обычным разбором входящего с подтверждением.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ source?: unknown; text?: unknown; pages?: unknown }>(event);
  let notes: ExternalNote[];
  try {
    if (body?.source === 'jira' && typeof body.text === 'string') {
      notes = jiraNotes(parseJira(body.text));
    } else if (body?.source === 'confluence' && Array.isArray(body.pages)) {
      const pages = (body.pages as Partial<ConfluencePage>[]).flatMap((page) => (typeof page?.title === 'string' && typeof page.body === 'string'
        ? [{ title: page.title, parent: typeof page.parent === 'string' ? page.parent : '', body: page.body }] : []));
      notes = confluenceNotes(pages);
    } else {
      return fail(event, 400, 'import_source_invalid', 'Нужен source: jira с text или confluence с pages');
    }
  } catch (error) {
    return fail(event, 400, 'import_unreadable', 'Выгрузка не читается', String(error));
  }
  if (notes.length === 0) return fail(event, 400, 'import_empty', 'В выгрузке не нашлось ни одной задачи или страницы');

  try {
    const paths: string[] = [];
    for (const note of notes) {
      const outcome = createNote(project.root, note);
      if (!outcome.ok) return fail(event, 400, outcome.code, outcome.message);
      paths.push(outcome.path);
    }
    return { count: paths.length, paths };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'import_failed', 'Не удалось сложить заметки на склад', String(error));
  }
});
