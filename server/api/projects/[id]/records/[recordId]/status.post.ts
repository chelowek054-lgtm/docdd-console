import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyStatusChange } from '../../../../../lib/actions';
import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail, failWith } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { openRecord, saveRecord, today, transitionBlockers } from '../../../../../utils/record-write';

/**
 * Смена статуса. Разрешён переход — меняем `status`, обновляем `updated`,
 * пишем строку в журнал. Запрещён — 409 с перечнем того, что мешает
 * (docs/03-server-api.md). Кнопкой это не обходится.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ status?: unknown; actor?: unknown }>(event);
  const status = typeof body?.status === 'string' ? body.status : '';
  const actor = typeof body?.actor === 'string' ? body.actor : '';
  if (!status) {
    return fail(event, 400, 'status_required', 'Не указан статус, в который переводим запись');
  }

  try {
    const blockers = transitionBlockers(project.root, recordId, status);
    if (blockers === null) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }
    if (blockers.length > 0) {
      return failWith(
        event,
        409,
        blockers[0]?.code ?? 'transition_forbidden',
        `Запись ${recordId} не может перейти в \`${status}\``,
        blockers.map((item) => ({ code: item.code, message: item.message }))
      );
    }

    const context = openRecord(project.root, recordId);
    if (!context) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }

    const outcome = applyStatusChange(context.original, { status, actor, today: today() });
    const saved = saveRecord(context, outcome, project.root);
    if (!saved.ok) {
      // Сторож не пропустил: документ остаётся таким, каким был.
      return failWith(
        event,
        422,
        'write_refused',
        'Запись отменена: изменение затронуло бы не только разрешённые поля',
        saved.problems.map((message) => ({ code: 'guard', message }))
      );
    }

    return { record: saved.record, journal: outcome.journal };
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'write_failed', 'Не удалось записать изменение', String(error));
  }
});
