import { randomBytes } from 'node:crypto';

import { useStorage } from 'nitropack/runtime';
import type { H3Event } from 'h3';
import { getCookie, getHeader } from 'h3';

import { isAgentSessionName, readAgentToken, readSession, signAgentToken, type UserAccount } from '../lib/auth';

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
  // Агент приходит с токеном на запуск (ADR-0033); человек — с cookie-сессией.
  const bearer = /^Bearer\s+(.+)$/i.exec(getHeader(event, 'authorization') ?? '')?.[1];
  if (bearer) {
    const agent = readAgentToken(bearer.trim(), await sessionSecret(), Date.now());
    const found = agent ? (await loadUsers()).find((user) => user.login === agent && user.agent) : undefined;
    return found ?? null;
  }
  const token = getCookie(event, SESSION_COOKIE);
  if (!token) return null;
  const login = readSession(token, await sessionSecret(), Date.now());
  if (!login || isAgentSessionName(login)) return null;
  const user = (await loadUsers()).find((item) => item.login === login) ?? null;
  // Учётка агента браузерной сессией не пользуется.
  return user && !user.agent ? user : null;
}

/** Токен на один запуск агента (ADR-0033): живёт шесть часов. Выдаёт его консоль, а не человек. */
export const AGENT_TOKEN_TTL_MS = 6 * 60 * 60 * 1000;
export async function agentToken(login: string): Promise<string> {
  return signAgentToken(login, Date.now() + AGENT_TOKEN_TTL_MS, await sessionSecret());
}
