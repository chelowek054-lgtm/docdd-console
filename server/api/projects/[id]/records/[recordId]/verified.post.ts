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

  const body = await readBody<{ verified?: unknown; actor?: unknown }>(event);
  if (typeof body?.verified !== 'boolean') {
    return fail(event, 400, 'verified_required', 'Не сказано, ставится отметка или снимается: нужно `verified: true` или `false`');
  }
  const actor = typeof body.actor === 'string' ? body.actor : '';

  try {
    const outcome = markVerified(project.root, recordId, body.verified, actor);
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
