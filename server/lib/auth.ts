import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Учётная запись приложения (docs/adr/0020-people-roles-permissions.md): не содержание проекта. */
export interface UserAccount {
  login: string;
  name: string;
  /** `scrypt$<соль hex>$<хеш hex>` */
  passwordHash: string;
  admin: boolean;
  /** Аккаунт агента (ADR-0033): пароля нет, вход — только токеном на запуск. */
  agent?: { type: string };
  /** Версия сессий (ADR-0040): токен с другой версией не пускает. Нет поля — 0. */
  sessionVersion?: number;
}

/** Хеш с солью: пароль в файле не хранится, а перебор по словарю дорог. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 32).toString('hex')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [kind, saltHex, hashHex] = stored.split('$');
  if (kind !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Сессия — подписанный токен без состояния на сервере: `логин.версия.срок.подпись` (ADR-0040). */
export function signSession(login: string, expiresAt: number, secret: string, version = 0): string {
  const head = `${Buffer.from(login, 'utf8').toString('base64url')}.${version}.${expiresAt}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

export interface SessionClaim {
  login: string;
  version: number;
}

/** Логин и версия из токена; подделка, просроченный и токен прежнего вида без версии дают null. */
export function readSession(token: string, secret: string, now: number): SessionClaim | null {
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [name, version, expires, mac] = parts as [string, string, string, string];
  if (!name || !version || !expires || !mac) return null;
  const expected = createHmac('sha256', secret).update(`${name}.${version}.${expires}`).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number.isFinite(Number(expires)) || Number(expires) < now) return null;
  if (!/^\d+$/.test(version)) return null;
  return { login: Buffer.from(name, 'base64url').toString('utf8'), version: Number(version) };
}

/** Версия сессий учётки; учётки до ADR-0040 поля не имеют — у них 0. */
export function sessionVersionOf(user: Pick<UserAccount, 'sessionVersion'>): number {
  const value = user.sessionVersion;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Запись учётки после `POST /api/auth/users` (ADR-0040): обновление ложится поверх прежней
 * записи — незнакомые поля остаются. Версия растёт у новой учётки и при смене пароля или
 * признака администратора; не меньше `now`, чтобы заново заведённый логин не оживил
 * токены прежнего владельца.
 */
export function mergeUserEntry(
  previous: UserAccount | undefined,
  update: Omit<UserAccount, 'sessionVersion'>,
  now: number
): UserAccount {
  const merged: UserAccount = { ...previous, ...update };
  // Обычную учётку можно превратить в агента и обратно: поле `agent` обновление задаёт целиком.
  if (!update.agent) delete merged.agent;
  const changed = !previous || previous.passwordHash !== update.passwordHash || previous.admin !== update.admin;
  if (changed) merged.sessionVersion = Math.max(previous ? sessionVersionOf(previous) + 1 : 0, now);
  return merged;
}

/** Подпись в журнале: `Иван Петров (architect)` (docs/adr/0020, п. 6). */
export function signature(name: string, roles: readonly string[]): string {
  return roles.length > 0 ? `${name} (${roles.join(', ')})` : name;
}

/** Автор коммита из подписи вида `Имя (роль)`; у свободного текста автора нет. */
export function authorFromSignature(actor: string): { name: string; email: string } | null {
  const match = /^(.+?) \(([^)]+)\)$/.exec(actor.trim());
  if (!match?.[1]) return null;
  return { name: match[1], email: `${match[1].toLowerCase().replace(/\s+/g, '.')}@docdd.local` };
}

/** Токен агента (ADR-0033): та же подпись, что у сессии, но с префиксом — cookie и токен не взаимозаменяемы. */
const AGENT_PREFIX = 'agent:';

export function signAgentToken(login: string, expiresAt: number, secret: string, version = 0): string {
  return signSession(`${AGENT_PREFIX}${login}`, expiresAt, secret, version);
}

/** Логин и версия агента из токена; не агентский, просрочен или подделан — `null`. */
export function readAgentToken(token: string, secret: string, now: number): SessionClaim | null {
  const claim = readSession(token, secret, now);
  return claim && claim.login.startsWith(AGENT_PREFIX)
    ? { login: claim.login.slice(AGENT_PREFIX.length), version: claim.version }
    : null;
}

/** Обычная сессия не может нести логин агента: агент через браузер не входит. */
export const isAgentSessionName = (name: string): boolean => name.startsWith(AGENT_PREFIX);
