import { timingSafeEqual } from 'node:crypto';

import { defineEventHandler, getHeader, getRouterParam, readBody } from 'h3';

import { alertNote } from '../../../../lib/metrics';
import { fail } from '../../../../utils/http';
import { createNote } from '../../../../utils/inbox-service';
import { findProject } from '../../../../utils/projects';

/**
 * Вебхук алертов Grafana (R-0065): алерт становится заметкой во входящем. Вход
 * сессией тут невозможен, поэтому дверь закрыта токеном `DOCDD_ALERT_TOKEN`
 * (заголовок Authorization: Bearer …); токен не задан — маршрут закрыт совсем.
 */
export default defineEventHandler(async (event) => {
  const expected = process.env['DOCDD_ALERT_TOKEN'] ?? '';
  if (!expected) return fail(event, 403, 'alert_disabled', 'Приём алертов выключен: не задан DOCDD_ALERT_TOKEN');
  const given = (getHeader(event, 'authorization') ?? '').replace(/^Bearer\s+/i, '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return fail(event, 401, 'alert_token_invalid', 'Неверный токен алерта');

  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  try {
    const note = alertNote(await readBody(event));
    const outcome = createNote(project.root, note);
    if (!outcome.ok) return fail(event, 400, outcome.code, outcome.message);
    return { path: outcome.path };
  } catch (error) {
    return fail(event, 500, 'note_failed', 'Не удалось сохранить заметку', String(error));
  }
});
