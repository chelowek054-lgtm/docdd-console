import { defineEventHandler, readBody } from 'h3';

import { hashPassword } from '../../lib/auth';
import { loadUsers, saveUsers } from '../../utils/auth';
import { fail } from '../../utils/http';

/**
 * Завести или обновить человека. Первого администратора заводит скрипт
 * развёртывания: пока учёток нет, middleware пускает сюда без сессии.
 */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ login?: unknown; name?: unknown; password?: unknown; admin?: unknown; agent?: unknown }>(event);
  const login = typeof body?.login === 'string' ? body.login.trim() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  // Аккаунт агента (ADR-0033): пароля нет, администратором не бывает, тип — из набора агентов.
  const agentType = typeof (body?.agent as { type?: unknown } | undefined)?.type === 'string' ? String((body?.agent as { type: string }).type) : '';
  if (agentType && !/^[a-z0-9-]{2,40}$/.test(agentType)) return fail(event, 400, 'agent_type_invalid', 'Тип агента — латиница, цифры и дефис');
  if (!/^[a-z0-9._-]{2,40}$/i.test(login) || (!agentType && password.length < 8)) {
    return fail(event, 400, 'user_invalid', 'Логин — латиница, цифры, . _ -; пароль — от 8 символов');
  }
  const users = await loadUsers();
  const entry = {
    login,
    name: typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : login,
    passwordHash: agentType ? '' : hashPassword(password),
    admin: agentType ? false : body?.admin === true,
    ...(agentType ? { agent: { type: agentType } } : {})
  };
  const at = users.findIndex((item) => item.login === login);
  if (at === -1) users.push(entry);
  else users[at] = entry;
  await saveUsers(users);
  return { login: entry.login, name: entry.name, admin: entry.admin, ...(entry.agent ? { agent: entry.agent } : {}) };
});
