import { defineEventHandler, readBody } from 'h3';

import { fail } from '../../utils/http';
import { saveChannelUrl } from '../../utils/notification-service';

/** Задать адрес вебхука (пустая строка — отключить). */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { admin?: unknown } }).user;
  if (user && user.admin !== true) return fail(event, 403, 'forbidden', 'Канал уведомлений настраивает только администратор');
  const body = (await readBody(event)) as { url?: unknown } | null;
  const url = typeof body?.url === 'string' ? body.url.trim() : null;
  if (url === null || (url !== '' && !/^https?:\/\/\S+$/.test(url))) return fail(event, 400, 'bad-request', 'Нужен url вида https://…');
  await saveChannelUrl(url);
  return { ok: true, hasUrl: url !== '' };
});
