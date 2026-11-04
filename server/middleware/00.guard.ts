import { defineEventHandler, getHeader, getRequestURL, setResponseStatus } from 'h3';

import { guardRequest, parseAllowedHosts } from '../lib/request-guard';
import { authEnabled } from '../utils/auth';

/**
 * Сторож до любого маршрута (docs/adr/0039-hardening-local-and-login.md): чужое имя
 * сервера и пишущий запрос с чужой страницы — отказ, раньше прав и журнала.
 */
export default defineEventHandler((event) => {
  const verdict = guardRequest(
    {
      method: event.method,
      path: getRequestURL(event).pathname,
      host: getHeader(event, 'host'),
      forwardedHost: getHeader(event, 'x-forwarded-host'),
      origin: getHeader(event, 'origin'),
      fetchSite: getHeader(event, 'sec-fetch-site')
    },
    { local: !authEnabled() && process.env['DOCDD_MODE'] !== 'shared', allowedHosts: parseAllowedHosts(process.env['DOCDD_ALLOWED_HOSTS']) }
  );
  if (verdict.allowed) return;
  setResponseStatus(event, 403);
  return { error: { code: verdict.code, message: verdict.message } };
});
