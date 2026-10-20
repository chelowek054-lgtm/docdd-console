import { randomBytes } from 'node:crypto';

import { useStorage } from 'nitropack/runtime';
import type { H3Event } from 'h3';
import { getCookie } from 'h3';

import { readSession, type UserAccount } from '../lib/auth';

/**
 * Вход выключен по умолчанию: локальный режим одного человека работает как раньше.
 * Включается `DOCDD_AUTH=on` (общий сервер).
 */
export function authEnabled(): boolean {
  return process.env['DOCDD_AUTH'] === 'on';
}

export const SESSION_COOKIE = 'docdd_session';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const storage = () => useStorage('data');

export async function loadUsers(): Promise<UserAccount[]> {
  const stored = await storage().getItem<UserAccount[]>('users.json');
  return Array.isArray(stored) ? stored : [];
}

export async function saveUsers(users: UserAccount[]): Promise<void> {
  await storage().setItem('users.json', users);
}

/** Секрет подписи сессий лежит в .data рядом с учётками: перезапуск не разлогинивает. */
export async function sessionSecret(): Promise<string> {
  const stored = await storage().getItem<string>('session-secret.json');
  if (typeof stored === 'string' && stored) return stored;
  const created = randomBytes(32).toString('hex');
  await storage().setItem('session-secret.json', created);
  return created;
}

export async function currentUser(event: H3Event): Promise<UserAccount | null> {
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const login = readSession(token, await sessionSecret(), Date.now());
  if (!login) return null;
  return (await loadUsers()).find((user) => user.login === login) ?? null;
}
