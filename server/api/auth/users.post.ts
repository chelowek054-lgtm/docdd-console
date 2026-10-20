import { defineEventHandler, readBody } from 'h3';

import { hashPassword } from '../../lib/auth';
import { loadUsers, saveUsers } from '../../utils/auth';
import { fail } from '../../utils/http';

/**
 * Завести или обновить человека. Первого администратора заводит скрипт
 * развёртывания: пока учёток нет, middleware пускает сюда без сессии.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: unknown; name?: unknown; password?: unknown; admin?: unknown }>(event);
  const login = typeof body?.login === 'string' ? body.login.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!/^[a-z0-9._-]{2,40}$/i.test(login) || password.length < 8) {
    return fail(event, 400, 'user_invalid', 'Логин — латиница, цифры, . _ -; пароль — от 8 символов');
  }
  const users = await loadUsers();
  const entry = {
    login,
    name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : login,
    passwordHash: hashPassword(password),
    admin: body?.admin === true
  };
  const at = users.findIndex((item) => item.login === login);
  if (at === -1) users.push(entry);
  else users[at] = entry;
  await saveUsers(users);
  return { login: entry.login, name: entry.name, admin: entry.admin };
});
