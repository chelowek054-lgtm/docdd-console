import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyStatusChange } from '../../../../../lib/actions';
import { deferAction } from '../../../../../lib/deferred';
import { OutsideRootError } from '../../../../../lib/paths';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail, failWith } from '../../../../../utils/http';
import { markDescribed } from '../../../../../utils/inventory-service';
import { findProject } from '../../../../../utils/projects';
import { journalNow, openRecordWithBlockers, saveRecord } from '../../../../../utils/record-write';
import { wasViewed } from '../../../../../utils/record-diff-service';

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

  const body = await readBody<{ status?: unknown; actor?: unknown; version?: unknown }>(event);
  const status = typeof body?.status === 'string' ? body.status : '';
  const actor = typeof body?.actor === 'string' ? body.actor : '';
  if (!status) {
    return fail(event, 400, 'status_required', 'Не указан статус, в который переводим запись');
  }

  try {
    const opened = openRecordWithBlockers(project.root, recordId, status);
    if (opened === null) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }
    const { context, blockers } = opened;
    if (versionConflict(context.record, body?.version)) {
      return fail(event, 409, 'record_changed_since_load', 'Запись изменили с тех пор, как вы её открыли: перечитайте и повторите правку');
    }
    // Бэклог — решение человека (R-0105): агент роли туда не уводит и не возвращает.
    if ((status === 'deferred' || context.record.status === 'deferred') && (event.context as { user?: { agent?: unknown } }).user?.agent) {
      return fail(event, 403, 'agent_deferred', 'В бэклог уводит и возвращает человек: агент может только предложить это текстом');
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

    const outcome = applyStatusChange(context.original, {
      status,
      actor,
      today: journalNow(project.root),
      // Журнал честно различает подтверждение с просмотром разницы и без (R-0068).
      ...(context.record.status === 'deferred'
        ? { action: deferAction(context.record.type, 'return', '') }
        : status === 'approved' && wasViewed(project.root, recordId, context.record.source.path)
          ? { action: 'подтверждено после просмотра разницы' }
          : {})
    });
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

    // Карту подтвердили — значит описанное ею закрыто: отмечаем отпечатки,
    // чтобы следующий заход не переописывал те же файлы (docs/07-maps.md).
    if (saved.record.type === 'map' && status === 'approved') {
      markDescribed(project.root, outcome.text);
    }

    notifyStatus(id, recordId, saved.record.type, status, context.record.data, project.root); return { record: saved.record, journal: outcome.journal };
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
import { versionConflict } from '../../../../../lib/version';
import { notifyStatus } from '../../../../../utils/notify-events';
