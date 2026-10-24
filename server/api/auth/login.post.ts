import { defineEventHandler, readBody, setCookie } from 'h3';

import { signSession, verifyPassword } from '../../lib/auth';
import { SESSION_COOKIE, SESSION_TTL_MS, loadUsers, sessionSecret } from '../../utils/auth';
import { fail } from '../../utils/http';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: unknown; password?: unknown }>(event);
  const login = typeof body?.login === 'string' ? body.login.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  const user = (await loadUsers()).find((item) => item.login === login);
  // Один ответ на «нет такого» и «не тот пароль»: логины не перебираются.
  // Агент через браузер не входит (ADR-0033): у него нет пароля, только токен на запуск.
  if (!user || user.agent || !verifyPassword(password, user.passwordHash)) {
    return fail(event, 401, 'login_failed', 'Неверный логин или пароль');
  }
  const token = signSession(user.login, Date.now() + SESSION_TTL_MS, await sessionSecret());
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'strict', path: '/', maxAge: SESSION_TTL_MS / 1000
  });
  return { login: user.login, name: user.name, admin: user.admin };
});
