import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { fail } from '../../../../utils/http';
import { readNotifications } from '../../../../utils/notification-service';
import { findProject } from '../../../../utils/projects';

/** Отметить прочитанным: `{ to, ids? }`; без `ids` — всё адресата. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!(await findProject(id))) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  const body = (await readBody<{ to?: string; ids?: string[] }>(event)) ?? {};
  await readNotifications(id, body.to ?? 'local', Array.isArray(body.ids) ? body.ids : []);
  return { ok: true };
});
