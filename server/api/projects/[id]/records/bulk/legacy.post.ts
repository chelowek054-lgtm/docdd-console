import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { BULK_LIMIT } from '../../../../../utils/bulk-service';
import { fail } from '../../../../../utils/http';
import { bulkLegacy } from '../../../../../utils/legacy-service';
import { findProject } from '../../../../../utils/projects';
import { staleVersions } from '../../../../../utils/record-write';

/**
 * Перевод пачки в прежний курс (A-0001, docs/03-server-api.md): одна причина на
 * всю пачку; ответ — отчёт по каждой записи, `200` и при отказах.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ ids?: unknown; reason?: unknown; legacy_by?: unknown; before?: unknown; actor?: unknown; versions?: unknown }>(event);
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0 || !ids.every((item): item is string => typeof item === 'string' && item !== '')) {
    return fail(event, 400, 'ids_required', 'Не названы записи: нужен непустой список номеров');
  }
  if (ids.length > BULK_LIMIT) {
    return fail(event, 400, 'ids_too_many', `За один раз — не больше ${BULK_LIMIT} записей`);
  }
  const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
  if (!reason) {
    return fail(event, 400, 'reason_required', 'Нужна причина: одна на всю пачку, она уйдёт в журнал каждой записи');
  }
  const legacyBy = typeof body?.legacy_by === 'string' && body.legacy_by ? body.legacy_by : null;
  if (legacyBy && !/^M-\d{4}$/.test(legacyBy)) {
    return fail(event, 400, 'legacy_by_invalid', 'Карта смены курса — номер вида M-0042');
  }
  const before = typeof body?.before === 'string' && body.before ? body.before : null;
  if (before && !/^(\d{4}-\d{2}-\d{2}|M-\d{4})$/.test(before)) {
    return fail(event, 400, 'before_invalid', 'Порог — дата ГГГГ-ММ-ДД или номер карты M-0042');
  }
  const stale = staleVersions(project.root, body?.versions);
  if (stale.length > 0) {
    return fail(event, 409, 'record_changed_since_load', `Записи изменили с тех пор, как вы их открыли: ${stale.join(', ')}. Перечитайте и повторите`);
  }

  try {
    return bulkLegacy(project.root, ids as string[], { reason, legacyBy, before, actor: typeof body?.actor === 'string' ? body.actor : '' });
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'write_failed', 'Не удалось записать изменения', String(error));
  }
});
