import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync, gzipSync } from 'node:zlib';

import { afterEach, describe, expect, it } from 'vitest';

import { MOCKUP_LIMIT, unzipEntries } from '../server/lib/design-mockups';
import { LoginThrottle } from '../server/lib/login-throttle';
import { OutsideRootError, resolveInside } from '../server/lib/paths';
import { guardRequest, hostName, parseAllowedHosts, type GuardRequest } from '../server/lib/request-guard';

/** Защита от чужих страниц, границы корня и входа (docs/adr/0039-hardening-local-and-login.md). */

const request = (over: Partial<GuardRequest>): GuardRequest => ({
  method: 'POST', path: '/api/projects', host: '127.0.0.1:3000', forwardedHost: undefined, origin: undefined, fetchSite: undefined, ...over
});
const LOCAL = { local: true, allowedHosts: [] as string[] };

describe('сторож запросов', () => {
  it('локально: чужое имя сервера (DNS rebinding) — отказ, свои имена и список — можно', () => {
    expect(guardRequest(request({ method: 'GET', host: 'evil.example:3000' }), LOCAL)).toMatchObject({ allowed: false, code: 'host_forbidden' });
    for (const host of ['localhost:3000', '127.0.0.1:3000', '[::1]:3000']) expect(guardRequest(request({ method: 'GET', host }), LOCAL).allowed).toBe(true);
    expect(guardRequest(request({ method: 'GET', host: 'docdd.lan' }), { local: true, allowedHosts: parseAllowedHosts('docdd.lan, other') }).allowed).toBe(true);
  });

  it('общий сервер: имя не сужается без списка, со списком — сужается', () => {
    expect(guardRequest(request({ method: 'GET', host: 'docdd.company.com' }), { local: false, allowedHosts: [] }).allowed).toBe(true);
    expect(guardRequest(request({ method: 'GET', host: 'evil.com' }), { local: false, allowedHosts: ['docdd.company.com'] }).allowed).toBe(false);
  });

  it('пишущий запрос с чужой страницы — отказ; со своей, без Origin и на чтение — можно', () => {
    expect(guardRequest(request({ origin: 'https://evil.example' }), LOCAL)).toMatchObject({ allowed: false, code: 'cross_origin_forbidden' });
    expect(guardRequest(request({ fetchSite: 'cross-site' }), LOCAL)).toMatchObject({ allowed: false, code: 'cross_origin_forbidden' });
    expect(guardRequest(request({ origin: 'null' }), LOCAL)).toMatchObject({ allowed: false });
    expect(guardRequest(request({ origin: 'http://127.0.0.1:3000', fetchSite: 'same-origin' }), LOCAL).allowed).toBe(true);
    expect(guardRequest(request({}), LOCAL).allowed).toBe(true);
    expect(guardRequest(request({ method: 'GET', origin: 'https://evil.example' }), LOCAL).allowed).toBe(true);
  });

  it('за nginx: Host без порта, Origin с портом — свой', () => {
    expect(guardRequest(request({ host: 'docdd.company.com', origin: 'https://docdd.company.com:8443' }), { local: false, allowedHosts: [] }).allowed).toBe(true);
  });

  it('имя хоста без порта и регистра', () => {
    expect(hostName('LocalHost:3000')).toBe('localhost');
    expect(hostName('[::1]:3000')).toBe('[::1]');
  });
});

describe('граница корня: ссылка наружу у папки выше', () => {
  const made: string[] = [];
  afterEach(() => { for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true }); });

  it('новый файл под ссылкой-папкой, ведущей за корень, — отказ', () => {
    const base = mkdtempSync(join(tmpdir(), 'docdd-root-'));
    made.push(base);
    const root = join(base, 'project');
    const outside = join(base, 'outside');
    mkdirSync(root);
    mkdirSync(outside);
    // Junction создаётся на Windows без прав администратора; на других ОС — обычная ссылка на папку.
    symlinkSync(outside, join(root, 'link'), 'junction');
    expect(() => resolveInside(root, 'link/new-file.md')).toThrow(OutsideRootError);
    expect(() => resolveInside(root, 'link/deeper/new-file.md')).toThrow(OutsideRootError);
    expect(resolveInside(root, 'docs/new-file.md')).toContain('project');
  });
});

/** Минимальный zip с одним файлом, сжатым deflate. */
function zipOf(name: string, data: Buffer, declaredSize = data.length): Buffer {
  const packed = deflateRawSync(data);
  const nameBytes = Buffer.from(name);
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(8, 8);
  local.writeUInt32LE(packed.length, 18);
  local.writeUInt32LE(declaredSize, 22);
  local.writeUInt16LE(nameBytes.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(packed.length, 20);
  central.writeUInt32LE(declaredSize, 24);
  central.writeUInt16LE(nameBytes.length, 28);
  central.writeUInt32LE(0, 42);
  const body = Buffer.concat([local, nameBytes, packed]);
  const dir = Buffer.concat([central, nameBytes]);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(body.length, 16);
  return Buffer.concat([body, dir, end]);
}

describe('предел распаковки', () => {
  it('обычный архив распаковывается', () => {
    expect(unzipEntries(zipOf('index.html', Buffer.from('<p>ok</p>')))[0]?.data.toString()).toBe('<p>ok</p>');
  });

  it('zip-бомба — отказ до того, как всё развернётся в памяти, даже если оглавление врёт о размере', () => {
    const huge = Buffer.alloc(MOCKUP_LIMIT + 1024 * 1024);
    expect(() => unzipEntries(zipOf('index.html', huge))).toThrow(/больше/);
    expect(() => unzipEntries(zipOf('index.html', huge, 10))).toThrow(/больше/);
  });

  it('gzip сверх предела не разворачивается', async () => {
    const { gunzipSync } = await import('node:zlib');
    const bomb = gzipSync(Buffer.alloc(MOCKUP_LIMIT + 1));
    expect(() => gunzipSync(bomb, { maxOutputLength: MOCKUP_LIMIT })).toThrow();
  });
});

describe('ограничение попыток входа', () => {
  it('5 неудач за окно — ждать; успех и конец окна сбрасывают', () => {
    const throttle = new LoginThrottle(5, 1000);
    for (let i = 0; i < 5; i += 1) {
      expect(throttle.retryAfter('ip', 'anna', i)).toBe(0);
      throttle.fail('ip', 'anna', i);
    }
    expect(throttle.retryAfter('ip', 'anna', 10)).toBeGreaterThan(0);
    expect(throttle.retryAfter('ip', 'boris', 10)).toBe(0);
    expect(throttle.retryAfter('other-ip', 'anna', 10)).toBe(0);
    expect(throttle.retryAfter('ip', 'ANNA', 10)).toBeGreaterThan(0);
    expect(throttle.retryAfter('ip', 'anna', 1001)).toBe(0);
    throttle.fail('ip', 'vera', 0);
    throttle.succeed('ip', 'vera');
    expect(throttle.retryAfter('ip', 'vera', 1)).toBe(0);
  });
});
