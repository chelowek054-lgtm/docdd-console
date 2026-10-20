import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

/** Учётная запись приложения (docs/adr/0020-people-roles-permissions.md): не содержание проекта. */
export interface UserAccount {
  login: string;
  name: string;
  /** `scrypt$<соль hex>$<хеш hex>` */
  passwordHash: string;
  admin: boolean;
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

/** Сессия — подписанный токен без состояния на сервере: `логин.срок.подпись`. */
export function signSession(login: string, expiresAt: number, secret: string): string {
  const head = `${Buffer.from(login, 'utf8').toString('base64url')}.${expiresAt}`;
  return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

/** Логин из токена; подделка и просроченный токен дают null. */
export function readSession(token: string, secret: string, now: number): string | null {
  const [name, expires, mac] = token.split('.');
  if (!name || !expires || !mac) return null;
  const expected = createHmac('sha256', secret).update(`${name}.${expires}`).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!Number.isFinite(Number(expires)) || Number(expires) < now) return null;
  return Buffer.from(name, 'base64url').toString('utf8');
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
