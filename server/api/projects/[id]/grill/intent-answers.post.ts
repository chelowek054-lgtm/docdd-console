import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { saveClarifications } from '../../../../utils/grill-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Ответы на уточняющие вопросы дописываются к заметке намерения; дальше идёт прежний разбор (R-0116). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);

  const body = await readBody<{ note?: unknown; answers?: unknown }>(event);
  const note = typeof body?.note === 'string' ? body.note : '';
  if (!note) return fail(event, 400, 'note_required', 'Не названа заметка намерения');
  const answers = Array.isArray(body?.answers)
    ? (body.answers as { text?: unknown; answer?: unknown }[]).flatMap((item) => (typeof item?.text === 'string' && typeof item.answer === 'string' ? [{ text: item.text, answer: item.answer }] : []))
    : [];
  const saved = saveClarifications(project.root, note, answers);
  return saved.ok ? { ok: true } : fail(event, saved.status, saved.code, saved.message);
});
