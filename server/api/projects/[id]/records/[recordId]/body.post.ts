import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { applyBodyEdit, isSettled } from '../../../../../lib/actions';
import { OutsideRootError } from '../../../../../lib/paths';
import { splitRecord } from '../../../../../lib/write';
import { WorkspaceError } from '../../../../../lib/workspace';
import { fail, failWith } from '../../../../../utils/http';
import { findProject } from '../../../../../utils/projects';
import { openRecord, saveRecord, today } from '../../../../../utils/record-write';

/**
 * Правка текста документа человеком (docs/adr/0011-body-editing.md). Раздел
 * «Журнал» и front matter сверх `updated` этот маршрут не трогает — сторож
 * `applyBodyEdit` откажет раньше, чем испорченный текст попадёт в файл.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const recordId = getRouterParam(event, 'recordId') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const payload = await readBody<{ body?: unknown; baseline?: unknown; actor?: unknown }>(event);
  const nextBody = typeof payload?.body === 'string' ? payload.body : null;
  const baseline = typeof payload?.baseline === 'string' ? payload.baseline : null;
  if (nextBody === null || baseline === null) {
    return fail(event, 400, 'body_required', 'Нужны и новый текст, и тот, с которого редактор начал правку');
  }
  const actor = typeof payload?.actor === 'string' ? payload.actor.trim() : '';

  try {
    const context = openRecord(project.root, recordId);
    if (!context) {
      return fail(event, 404, 'record_not_found', `Записи \`${recordId}\` в проекте нет`);
    }

    if (isSettled(context.record.status)) {
      return fail(
        event,
        403,
        'record_settled',
        `Запись в статусе \`${context.record.status}\`: содержание подтверждено, правка текста задним числом ` +
          'запрещена. Нужна другая запись — свяжите её через `supersedes`',
        context.record.status
      );
    }

    const current = splitRecord(context.original);
    if (!current) {
      return fail(event, 422, 'parse_failed', 'Файл не является записью с front matter', context.absolute);
    }
    if (current.body !== baseline) {
      return fail(
        event,
        409,
        'body_changed_since_load',
        'Запись поменялась с тех пор, как вы открыли редактор — правкой снаружи или другим действием на этой же ' +
          'странице (например, сменой статуса: она тоже пишет строку в журнал). Перечитайте запись и внесите правку заново'
      );
    }

    const outcome = applyBodyEdit(context.original, { body: nextBody, actor, today: today() });
    const saved = saveRecord(context, outcome, project.root);
    if (!saved.ok) {
      return failWith(
        event,
        422,
        'write_refused',
        'Правка отменена: задет раздел журнала или поле, которое эта правка менять не вправе',
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
    return fail(event, 500, 'write_failed', 'Не удалось записать правку', String(error));
  }
});
