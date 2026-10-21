// V-0041 manual — автотест подготовка (скорость на большом проекте проверяет человек).
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readWorkspace } from '../server/lib/workspace';
import { fingerprintProject, memoByFingerprint } from '../server/utils/memo';

const LF = String.fromCharCode(10);
let root = '';
const file = () => join(root, 'docs', 'development', 'requirements', 'R-0001-a.md');
const write = (title: string) => writeFileSync(file(), ['---', 'id: R-0001', 'type: requirement', `title: ${title}`, 'status: draft', 'created: 2026-01-01', 'updated: 2026-01-01', '---', '', `# ${title}`, ''].join(LF), 'utf8');

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-r41-'));
  mkdirSync(join(root, 'docs', 'development', 'requirements'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: d', '  name: D', 'paths:', '  requirements: requirements', ''].join(LF), 'utf8');
  write('Один');
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('R-0041: кэш и мемо', () => {
  it('отпечаток стабилен без правок и меняется при правке файла (mtime/size)', () => {
    const a = fingerprintProject(root);
    expect(fingerprintProject(root)).toBe(a);
    write('Другой заголовок длиннее');
    expect(fingerprintProject(root)).not.toBe(a);
  });

  it('правка с тем же размером, но новым mtime, перечитывается', () => {
    write('Один');
    const t1 = new Date('2026-02-01T00:00:00Z');
    utimesSync(file(), t1, t1);
    const before = readWorkspace(root).files.find((f) => f.source.path.includes('R-0001'))?.text.match(/title: (.*)/)?.[1];
    write('Дваж');
    const t2 = new Date('2026-03-01T00:00:00Z');
    utimesSync(file(), t2, t2);
    expect(before).toBe('Один');
    expect(readWorkspace(root).files.find((f) => f.source.path.includes('R-0001'))?.text.match(/title: (.*)/)?.[1]).toBe('Дваж');
  });

  it('мемо по отпечатку проекта: тот же — кэш, после правки — пересчёт', () => {
    let runs = 0;
    const get = () => memoByFingerprint(root, 'review', () => fingerprintProject(root), () => ++runs);
    get(); get();
    expect(runs).toBe(1);
    write('Совсем новый заголовок');
    get();
    expect(runs).toBe(2);
  });
});
