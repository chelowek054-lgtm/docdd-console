import { defineEventHandler, getHeader, getRequestIP, readBody, setCookie, setHeader } from 'h3';

import { signSession, verifyPassword } from '../../lib/auth';
import { SESSION_COOKIE, SESSION_TTL_MS, loadUsers, sessionSecret } from '../../utils/auth';
import { fail } from '../../utils/http';
import { LoginThrottle } from '../../lib/login-throttle';

/** Один счётчик на процесс (ADR-0039). */
const throttle = new LoginThrottle();
/** Хеш, который проверяется для несуществующего логина: время ответа не выдаёт, есть ли такой. */
const DECOY_HASH = 'scrypt$1b83f03b190eb43e1099c070f1382251$73225ab5c17c49cf2102dd5d4fce75d3d1ec9c9ff7a78ab8b20592463f8acaae';

export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: unknown; password?: unknown }>(event);
  const login = typeof body?.login === 'string' ? body.login.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  // X-Forwarded-For верим только за nginx общего сервера: локально его подделает кто угодно.
  const address = getRequestIP(event, { xForwardedFor: process.env['DOCDD_MODE'] === 'shared' }) ?? 'unknown';
  const now = Date.now();

  const wait = throttle.retryAfter(address, login, now);
  if (wait > 0) {
    setHeader(event, 'Retry-After', Math.ceil(wait / 1000));
    return fail(event, 429, 'login_throttled', 'Слишком много неудачных попыток входа. Попробуйте позже');
  }

  const user = (await loadUsers()).find((item) => item.login === login);
  // Один ответ на «нет такого» и «не тот пароль»: логины не перебираются — ни по тексту, ни по
  // времени, поэтому пароль сверяется всегда, хотя бы с подставным хешем.
  // Агент через браузер не входит (ADR-0033): у него нет пароля, только токен на запуск.
  const passwordOk = verifyPassword(password, user && !user.agent ? user.passwordHash : DECOY_HASH);
  if (!user || user.agent || !passwordOk) {
    throttle.fail(address, login, now);
    return fail(event, 401, 'login_failed', 'Неверный логин или пароль');
  }
  throttle.succeed(address, login);

  const token = signSession(user.login, now + SESSION_TTL_MS, await sessionSecret());
  // За HTTPS (nginx передаёт X-Forwarded-Proto) cookie не уходит по открытому каналу.
  const secure = getHeader(event, 'x-forwarded-proto')?.split(',')[0]?.trim() === 'https';
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'strict', path: '/', maxAge: SESSION_TTL_MS / 1000, secure
  });
  return { login: user.login, name: user.name, admin: user.admin };
});
