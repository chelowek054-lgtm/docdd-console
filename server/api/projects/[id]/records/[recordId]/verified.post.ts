import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { markVerified } from '../../../../../utils/verified-service';

/**
 * Отметка «Проверено» на ручной проверке (docs/03-server-api.md). Ставит или
 * снимает её отчётом в `tests/reports` и строкой в журнале записи.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ verified?: unknown; actor?: unknown; by?: unknown; note?: unknown; steps?: unknown }>(event);
  if (typeof body?.verified !== 'boolean') {
    return fail(event, 400, 'verified_required', 'Не сказано, ставится отметка или снимается: нужно `verified: true` или `false`');
  }
  const actor = typeof body.actor === 'string' ? body.actor : '';
  const by = typeof body.by === 'string' ? body.by.trim() : '';
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  if (by.length > 80) return fail(event, 400, 'by_too_long', 'Имя проверившего — не длиннее 80 знаков');
  // Одна-две строки: заметка — подпись к отметке, а не отчёт.
  if (note.length > 300 || note.split('\n').length > 2) {
    return fail(event, 400, 'note_too_long', 'Что проверено — до 300 знаков и не больше двух строк');
  }

  try {
    const outcome = markVerified(project.root, recordId, body.verified, actor, {
      by, login: (event.context['user'] as { login?: string } | undefined)?.login,
      note,
      steps: Array.isArray(body.steps)
        ? body.steps.map((state) => ({ text: '', state: state === 'failed' ? 'failed' as const : 'passed' as const }))
        : undefined
    });
    if (!outcome.ok) return fail(event, outcome.status, outcome.code, outcome.message);
    return outcome;
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'write_failed', 'Не удалось записать отметку', String(error));
  }
});
