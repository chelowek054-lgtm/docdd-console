import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { fail } from '../../../../utils/http';
import { readNotifications } from '../../../../utils/notification-service';
import { notificationReader } from '../../../../utils/notification-reader';
import { findProject } from '../../../../utils/projects';

/** Отметить прочитанным: `{ ids? }`; без `ids` — всё читателя. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!(await findProject(id))) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  const reader = await notificationReader(event);
  if (!reader) return fail(event, 401, 'unauthorized', 'Войдите, чтобы отмечать уведомления');
  const body = (await readBody<{ ids?: string[] }>(event).catch(() => null)) ?? {};
  await readNotifications(id, reader, Array.isArray(body.ids) ? body.ids : []);
  return { ok: true };
});
