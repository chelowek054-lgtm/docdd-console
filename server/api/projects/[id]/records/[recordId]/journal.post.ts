import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyJournalNote } from '../../../../../lib/actions';
import { fail, failWith } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { journalNow, openRecord, saveRecord } from '../../../../../utils/record-write';

const MAX_NOTE = 500;

/**
 * Заметка в журнал (R-0107). Журнал и front matter — всё, что доступно модели
 * (ADR-0011). Пометка «заметка» не даёт выдать строку за переход статуса:
 * время этапов считается по журналу (ADR-0039).
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ text?: unknown; actor?: unknown }>(event);
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
  if (!text) return fail(event, 400, 'text_required', 'Заметка пуста');
  if (text.length > MAX_NOTE) return fail(event, 400, 'text_too_long', `Заметка длиннее ${MAX_NOTE} знаков`);

  const context = await openRecord(project.root, recordId);
  if (!context) return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
  const outcome = applyJournalNote(context.original, {
    action: `заметка: ${text.replace(/·/g, '-')}`,
    actor: typeof body?.actor === 'string' && body.actor ? body.actor : 'модель',
    today: journalNow(project.root)
  });
  const saved = saveRecord(context, outcome, project.root);
  if (!saved.ok) return failWith(event, 409, 'record_not_saved', `Заметку в ${recordId} записать не удалось`, saved.problems.map((message) => ({ code: 'record_not_saved', message })));
  return { ok: true };
});
