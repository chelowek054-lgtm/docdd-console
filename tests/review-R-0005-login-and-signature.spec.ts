// V-0005 (unit): проверка по тексту требования R-0005, а не по коду. Вход, сессия, подпись автора.
import { describe, expect, it } from 'vitest';

import { authorFromSignature, hashPassword, readSession, signSession, signature, verifyPassword } from '../server/lib/auth';

describe('R-0005: пароль', () => {
  it('хранится хешем scrypt с солью, верный проходит, неверный нет', () => {
    const stored = hashPassword('correct horse');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(stored).not.toContain('correct horse');
    expect(verifyPassword('correct horse', stored)).toBe(true);
    expect(verifyPassword('wrong', stored)).toBe(false);
    expect(verifyPassword('', stored)).toBe(false);
    expect(hashPassword('correct horse')).not.toBe(stored); // соль случайна
  });
  it('испорченный хеш не пускает и не падает', () => {
    for (const bad of ['', 'plain', 'md5$aa$bb', 'scrypt$$', 'scrypt$zz']) expect(verifyPassword('x', bad)).toBe(false);
  });
});

describe('R-0005: сессия', () => {
  const now = 1_000_000;
  it('возвращает логин, в том числе не-ASCII и с точкой', () => {
    expect(readSession(signSession('иван.п', now + 10, 's'), 's', now)).toBe('иван.п');
  });
  it('подделка, чужой секрет, срок и мусор дают null', () => {
    const token = signSession('ivan', now + 10, 's');
    expect(readSession(token, 'other', now)).toBeNull();
    expect(readSession(token, 's', now + 11)).toBeNull();
    const [, exp, mac] = token.split('.');
    const forged = `${Buffer.from('admin').toString('base64url')}.${exp}.${mac}`;
    expect(readSession(forged, 's', now)).toBeNull();
    for (const bad of ['', 'a', 'a.b', 'a.b.c', '..']) expect(readSession(bad, 's', now)).toBeNull();
  });
});

describe('R-0005: подпись автора', () => {
  it('имя и роли; без ролей — одно имя', () => {
    expect(signature('Иван Петров', ['architect'])).toBe('Иван Петров (architect)');
    expect(signature('Иван', ['a', 'b'])).toBe('Иван (a, b)');
    expect(signature('Иван', [])).toBe('Иван');
  });
  it('автор коммита берётся только из подписи вида «Имя (роль)»', () => {
    expect(authorFromSignature('Иван Петров (architect)')?.name).toBe('Иван Петров');
    expect(authorFromSignature('architect')).toBeNull();
    expect(authorFromSignature('')).toBeNull();
  });
});
