import { defineEventHandler, getRouterParam } from 'h3';

import { visibleTo } from '../../../../lib/notifications';
import { fail } from '../../../../utils/http';
import { listNotifications } from '../../../../utils/notification-service';
import { notificationReader } from '../../../../utils/notification-reader';
import { findProject } from '../../../../utils/projects';

/** Уведомления читателя, новые сверху: вошедшего — его, без входа — все (консоль одного человека). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  if (!(await findProject(id))) {
    return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  }
  // Адресата решает сервер по входу, а не браузер: чужие уведомления по ?to= не читаются.
  const reader = await notificationReader(event);
  if (!reader) return fail(event, 401, 'unauthorized', 'Войдите, чтобы видеть уведомления');
  const items = visibleTo(await listNotifications(id), reader);
  return { items, unread: items.filter((item) => !item.read).length };
});
