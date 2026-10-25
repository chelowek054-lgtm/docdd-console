import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyDueFromTag } from '../../../../../lib/actions';
import { OutsideRootError } from '../../../../../lib/paths';
import { dueFromTags } from '../../../../../lib/timing';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail, failWith } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { journalNow, openRecord, saveRecord } from '../../../../../utils/record-write';

/**
 * «Перенести срок из тега» (ADR-0039): `due-ГГГГ-ММ-ДД` → поле `due`, тег убран,
 * строка в журнале. Тег сроком не считается — это вход для переноса, не больше.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  if ((event.context as { user?: { agent?: unknown } }).user?.agent) {
    return fail(event, 403, 'agent_timing_edit', 'Срок меняет человек: агент может только предложить его текстом');
  }
  const body = await readBody<{ actor?: unknown } | null>(event);

  try {
    const context = openRecord(project.root, recordId);
    if (!context) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    const tags = Array.isArray(context.record.data['tags']) ? (context.record.data['tags'] as unknown[]).filter((tag): tag is string => typeof tag === 'string') : [];
    const moved = dueFromTags(tags);
    if (!moved) return fail(event, 400, 'no_due_tag', `У ${recordId} нет тега вида due-ГГГГ-ММ-ДД`);
    const outcome = applyDueFromTag(context.original, { ...moved, actor: typeof body?.actor === 'string' ? body.actor : '', today: journalNow(project.root) });
    const saved = saveRecord(context, outcome, project.root);
    if (!saved.ok) {
      return failWith(event, 422, 'write_refused', 'Запись отменена: изменение затронуло бы не только срок и теги', saved.problems.map((message) => ({ code: 'guard', message })));
    }
    return { record: saved.record, due: moved.due };
  } catch (error) {
    if (error instanceof OutsideRootError) return fail(event, 403, 'outside_root', error.message, error.requested);
    if (error instanceof WorkspaceError) return fail(event, 422, error.code, error.message, error.detail);
    return fail(event, 500, 'write_failed', 'Не удалось перенести срок', String(error));
  }
});
