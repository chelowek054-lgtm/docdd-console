import { defineEventHandler } from 'h3';

import { fail } from '../../utils/http';
import { loadChannelUrl } from '../../utils/notification-service';

/** Внешний канал уведомлений: адрес не отдаётся, только факт, что он задан. */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { admin?: unknown } }).user;
  if (user && user.admin !== true) return fail(event, 403, 'forbidden', 'Канал уведомлений настраивает только администратор');
  return { hasUrl: (await loadChannelUrl()) !== '', fromEnv: Boolean(process.env['DOCDD_NOTIFY_WEBHOOK']?.trim()) };
});
