// ADR-0040: версия сессии — смена пароля и прав закрывает выданные сессии.
import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { mergeUserEntry, readAgentToken, readSession, sessionVersionOf, signAgentToken, signSession, type UserAccount } from '../server/lib/auth';

const now = 1_000_000;
const secret = 's';

describe('ADR-0040: версия в токене', () => {
  it('токен несёт версию под подписью', () => {
    expect(readSession(signSession('ivan', now + 10, secret, 7), secret, now)).toEqual({ login: 'ivan', version: 7 });
    expect(readSession(signSession('ivan', now + 10, secret), secret, now)?.version).toBe(0);
  });
  it('версию нельзя подменить, не сломав подпись', () => {
    const [name, , exp, mac] = signSession('ivan', now + 10, secret, 1).split('.');
    expect(readSession(`${name}.2.${exp}.${mac}`, secret, now)).toBeNull();
  });
  it('токен прежнего вида без версии не читается, даже с верной подписью', () => {
    const head = `${Buffer.from('ivan').toString('base64url')}.${now + 10}`;
    const legacy = `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
    expect(readSession(legacy, secret, now)).toBeNull();
  });
  it('версия не число — отказ даже с верной подписью', () => {
    const head = `${Buffer.from('ivan').toString('base64url')}.-1.${now + 10}`;
    const odd = `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
    expect(readSession(odd, secret, now)).toBeNull();
  });
  it('токен агента несёт версию агента', () => {
    expect(readAgentToken(signAgentToken('qa-bot', now + 10, secret, 5), secret, now)).toEqual({ login: 'qa-bot', version: 5 });
  });
});

describe('ADR-0040: версия учётки', () => {
  it('нет поля или оно не число — 0', () => {
    expect(sessionVersionOf({})).toBe(0);
    expect(sessionVersionOf({ sessionVersion: 'x' as unknown as number })).toBe(0);
    expect(sessionVersionOf({ sessionVersion: -3 })).toBe(0);
    expect(sessionVersionOf({ sessionVersion: 1.5 })).toBe(0);
    expect(sessionVersionOf({ sessionVersion: 42 })).toBe(42);
  });
});

describe('ADR-0040: запись учётки при обновлении', () => {
  const ann: UserAccount = { login: 'ann', name: 'Анна', passwordHash: 'scrypt$a$b', admin: true, sessionVersion: 5 };

  it('новая учётка получает версию не меньше текущего времени', () => {
    const created = mergeUserEntry(undefined, { login: 'bob', name: 'Боб', passwordHash: 'h', admin: false }, now);
    expect(created.sessionVersion).toBe(now);
  });
  it('смена пароля поднимает версию', () => {
    const next = mergeUserEntry(ann, { ...ann, passwordHash: 'scrypt$c$d' }, 3);
    expect(next.sessionVersion).toBe(6);
  });
  it('снятие администратора поднимает версию, не ниже текущего времени', () => {
    const next = mergeUserEntry(ann, { login: 'ann', name: 'Анна', passwordHash: ann.passwordHash, admin: false }, now);
    expect(next.sessionVersion).toBe(now);
    expect(next.admin).toBe(false);
  });
  it('без смены пароля и прав версия та же', () => {
    const next = mergeUserEntry(ann, { login: 'ann', name: 'Анна П.', passwordHash: ann.passwordHash, admin: true }, now);
    expect(next.sessionVersion).toBe(5);
    expect(next.name).toBe('Анна П.');
  });
  it('учётка без поля версии после смены пароля получает версию', () => {
    const legacy: UserAccount = { login: 'old', name: 'old', passwordHash: 'h1', admin: false };
    expect(mergeUserEntry(legacy, { ...legacy, passwordHash: 'h2' }, 2).sessionVersion).toBe(2);
  });
  it('незнакомые поля сохраняются', () => {
    const stored = { ...ann, theme: 'dark', extra: { a: 1 } } as UserAccount;
    const next = mergeUserEntry(stored, { login: 'ann', name: 'Анна', passwordHash: 'scrypt$e$f', admin: true }, now) as UserAccount & Record<string, unknown>;
    expect(next['theme']).toBe('dark');
    expect(next['extra']).toEqual({ a: 1 });
  });
  it('повторная запись агента версию не меняет, а снятое поле агента уходит', () => {
    const bot: UserAccount = { login: 'qa-bot', name: 'QA', passwordHash: '', admin: false, agent: { type: 'qa' }, sessionVersion: 9 };
    expect(mergeUserEntry(bot, { login: 'qa-bot', name: 'QA', passwordHash: '', admin: false, agent: { type: 'qa' } }, now).sessionVersion).toBe(9);
    const human = mergeUserEntry(bot, { login: 'qa-bot', name: 'QA', passwordHash: 'h', admin: false }, now);
    expect(human.agent).toBeUndefined();
  });
});
