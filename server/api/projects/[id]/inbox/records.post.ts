import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { isProposedType, type ProposedRecord } from '../../../../lib/inbox';
import { normalizeRoot, OutsideRootError } from '../../../../lib/paths';
import { WorkspaceError } from '../../../../lib/workspace';
import { fail, failWith } from '../../../../utils/http';
import { createRecords, proposalOf } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * Завести записи по подтверждённому человеком списку (docs/10-inbox.md).
 *
 * Приходит либо готовый список (человек его правил на экране), либо ответ
 * модели целиком — тогда он сперва разбирается и проверяется схемой. Записи
 * создаёт приложение: номера, front matter и имена файлов — его работа.
 */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }

  const body = await readBody<{ answer?: unknown; records?: unknown; notes?: unknown }>(event);
  const notes = Array.isArray(body?.notes)
    ? body.notes.filter((note): note is string => typeof note === 'string')
    : [];

  let proposed: ProposedRecord[] = [];

  if (typeof body?.answer === 'string' && body.answer.trim() !== '') {
    const parsed = proposalOf(body.answer);
    if (parsed.problems.length > 0) {
      return failWith(
        event,
        422,
        'records_invalid',
        'Ответ модели не прошёл схему: записи не заведены',
        parsed.problems.map((problem) => ({ code: 'records', message: problem }))
      );
    }
    proposed = parsed.records;
  } else if (Array.isArray(body?.records)) {
    proposed = body.records as ProposedRecord[];
  }

  // Список правил человек, и в нём может оказаться что угодно: проверяем сами.
  const broken = proposed.filter((record) => !record?.key || !record?.title || !isProposedType(record?.type));
  if (broken.length > 0) {
    return fail(event, 400, 'records_broken', 'В списке есть записи без ключа, заголовка или с неизвестным типом');
  }

  try {
    const outcome = createRecords(normalizeRoot(project.root), proposed, notes);
    return outcome.ok ? outcome : fail(event, 409, outcome.code, outcome.message);
  } catch (error) {
    if (error instanceof OutsideRootError) {
      return fail(event, 403, 'outside_root', error.message, error.requested);
    }
    if (error instanceof WorkspaceError) {
      return fail(event, 422, error.code, error.message, error.detail);
    }
    return fail(event, 500, 'records_failed', 'Не удалось завести записи', String(error));
  }
});
