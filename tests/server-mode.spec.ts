// V-0003 (R-0003, T-0007/T-0008/T-0010): режим shared — отказы на опасных маршрутах, проекты только из разрешённых каталогов.
import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { normalizeRoot } from '../server/lib/paths';
import { isSharedMode, projectRoots, rootAllowed, sharedDenied } from '../server/utils/mode';

const fakeEvent = () => ({ node: { req: {}, res: { statusCode: 200 } } }) as never;
const saved = { mode: process.env.DOCDD_MODE, roots: process.env.DOCDD_PROJECT_ROOTS };
afterEach(() => {
  if (saved.mode === undefined) delete process.env.DOCDD_MODE; else process.env.DOCDD_MODE = saved.mode;
  if (saved.roots === undefined) delete process.env.DOCDD_PROJECT_ROOTS; else process.env.DOCDD_PROJECT_ROOTS = saved.roots;
});

describe('sharedDenied', () => {
  it('в shared — 403 server_mode_shared с причиной', () => {
    process.env.DOCDD_MODE = 'shared';
    const event = fakeEvent();
    const got = sharedDenied(event, 'Свободный запрос к модели');
    expect(got?.error.code).toBe('server_mode_shared');
    expect(got?.error.message).toContain('Свободный запрос к модели');
    expect((event as { node: { res: { statusCode: number } } }).node.res.statusCode).toBe(403);
  });

  it('локальный режим и любое другое значение — без отказа', () => {
    delete process.env.DOCDD_MODE;
    expect(sharedDenied(fakeEvent(), 'x')).toBeNull();
    process.env.DOCDD_MODE = 'Shared';
    expect(isSharedMode()).toBe(false);
    process.env.DOCDD_MODE = '';
    expect(sharedDenied(fakeEvent(), 'x')).toBeNull();
  });
});

describe('sharedDenied со входом', () => {
  it('shared + DOCDD_AUTH=on — право проверяет middleware; без входа отказ', () => {
    process.env.DOCDD_MODE = 'shared';
    process.env.DOCDD_AUTH = 'on';
    expect(sharedDenied(fakeEvent(), 'x')).toBeNull();
    delete process.env.DOCDD_AUTH;
    expect(sharedDenied(fakeEvent(), 'x')?.error.code).toBe('server_mode_shared');
  });
});

describe('rootAllowed: сегменты', () => {
  it('каталог ..foo внутри корня допустим, настоящий .. — нет', () => {
    const base = mkdtempSync(join(tmpdir(), 'docdd-seg-'));
    mkdirSync(join(base, '..foo'));
    process.env.DOCDD_MODE = 'shared';
    process.env.DOCDD_PROJECT_ROOTS = base;
    expect(rootAllowed(join(base, '..foo'))).toBe(true);
    expect(rootAllowed(join(base, '..'))).toBe(false);
    rmSync(base, { recursive: true, force: true });
  });
});

describe('rootAllowed', () => {
  const dirs: string[] = [];
  const tmp = () => { const d = mkdtempSync(join(tmpdir(), 'docdd-mode-')); dirs.push(d); return d; };
  afterEach(() => { for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true }); });

  it('в shared без DOCDD_PROJECT_ROOTS — отказ всем; в локальном — разрешено всё', () => {
    delete process.env.DOCDD_PROJECT_ROOTS;
    process.env.DOCDD_MODE = 'shared';
    expect(rootAllowed(tmpdir())).toBe(false);
    process.env.DOCDD_PROJECT_ROOTS = '  ';
    expect(projectRoots()).toEqual([]);
    expect(rootAllowed(tmpdir())).toBe(false);
    delete process.env.DOCDD_MODE;
    expect(rootAllowed(tmpdir())).toBe(true);
  });

  it('внутри каталога — можно, сам каталог — можно, сосед с общим префиксом и родитель — нельзя', () => {
    const base = tmp();
    mkdirSync(join(base, 'projects', 'a'), { recursive: true });
    mkdirSync(join(base, 'projects-evil'), { recursive: true });
    process.env.DOCDD_MODE = 'shared';
    process.env.DOCDD_PROJECT_ROOTS = join(base, 'projects');
    const real = projectRoots()[0] as string;
    expect(rootAllowed(real)).toBe(true);
    expect(rootAllowed(join(real, 'a'))).toBe(true);
    expect(rootAllowed(join(real, '..', 'projects-evil'))).toBe(false);
    expect(rootAllowed(base)).toBe(false);
  });

  it('символическая ссылка наружу не проходит, если путь развёрнут', () => {
    const base = tmp();
    mkdirSync(join(base, 'projects'));
    mkdirSync(join(base, 'outside'));
    try { symlinkSync(join(base, 'outside'), join(base, 'projects', 'link'), 'junction'); } catch { return; }
    process.env.DOCDD_MODE = 'shared';
    process.env.DOCDD_PROJECT_ROOTS = join(base, 'projects');
    expect(rootAllowed(normalizeRoot(join(base, 'projects', 'link')))).toBe(false);
  });

  it('несколько каталогов через разделитель PATH', () => {
    const a = tmp(); const b = tmp();
    process.env.DOCDD_PROJECT_ROOTS = [a, b].join(process.platform === 'win32' ? ';' : ':');
    process.env.DOCDD_MODE = 'shared';
    expect(rootAllowed(projectRoots()[1] as string)).toBe(true);
  });
});
