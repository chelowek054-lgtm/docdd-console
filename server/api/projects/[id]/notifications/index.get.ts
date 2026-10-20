import { defineEventHandler, getQuery, getRouterParam } from 'h3';

import { forRecipient } from '../../../../lib/notifications';
import { fail } from '../../../../utils/http';
import { listNotifications } from '../../../../utils/notification-service';
import { findProject } from '../../../../utils/projects';

/** Уведомления адресата (`?to=`), новые сверху. Кто «я» — решит вход; пока адресат в запросе. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!(await findProject(id))) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  const to = String(getQuery(event)['to'] ?? 'local');
  const items = forRecipient(await listNotifications(id), to);
  return { items, unread: items.filter((item) => !item.read).length };
});
