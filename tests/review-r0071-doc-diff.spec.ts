// V-0071
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { diffRecordTexts } from '../server/lib/record-diff';
import { recordDiff } from '../server/utils/record-diff-service';

/** R-0071: поля «поле · было · стало», текст построчно, связи «+/−»; «было» — последний approved-коммит, иначе предыдущий. */

const LF = String.fromCharCode(10);
const doc = (front: string[], body: string) => ['---', 'id: R-0001', 'type: requirement', ...front, '---', '', body, ''].join(LF);

describe('поля, текст и связи', () => {
  const was = doc(['title: Старое', 'status: approved', 'updated: 2026-10-01', 'custom: 1', 'links:', '  verifies: [V-0001]', '  depends_on: [T-0001, T-0002]'], 'Строка 1\nСтрока 2');
  const now = doc(['title: Новое', 'status: review', 'updated: 2026-10-20', 'custom: 2', 'extra:', '  k: v', 'links:', '  verifies: [V-0001]', '  depends_on: [T-0002, T-0003]'], 'Строка 1\nСтрока 2 изменена');
  const diff = diffRecordTexts('R-0001', 'requirement', was, now);

  it('поля таблицей «поле · было · стало»; updated и links в таблицу не попадают', () => {
    expect(diff.fields).toEqual([
      { field: 'title', before: 'Старое', after: 'Новое' },
      { field: 'status', before: 'approved', after: 'review' },
      { field: 'custom', before: '1', after: '2' },
      { field: 'extra', before: '', after: '{"k":"v"}' }
    ]);
  });

  it('связи: «+ вид цель» и «− вид цель», неизменные не показываются', () => {
    expect(diff.links).toEqual([
      { sign: '+', kind: 'depends_on', target: 'T-0003' },
      { sign: '-', kind: 'depends_on', target: 'T-0001' }
    ]);
  });

  it('текст построчно: общая, убранная, добавленная', () => {
    expect(diff.text.map((line) => `${line.kind}:${line.text}`)).toEqual(['same:', 'same:Строка 1', 'del:Строка 2', 'add:Строка 2 изменена', 'same:']);
  });

  it('связь одним значением вместо списка тоже читается', () => {
    const a = doc(['links:', '  implements: R-0001'], 'x');
    const b = doc(['links:', '  implements: R-0002'], 'x');
    expect(diffRecordTexts('T', 'task', a, b).links).toEqual([
      { sign: '+', kind: 'implements', target: 'R-0002' },
      { sign: '-', kind: 'implements', target: 'R-0001' }
    ]);
  });

  it('только updated поменялся — разницы нет', () => {
    const a = doc(['updated: 2026-10-01'], 'x');
    const b = doc(['updated: 2026-10-02'], 'x');
    expect(diffRecordTexts('T', 'task', a, b).empty).toBe(true);
  });
});

describe('«было»: последний approved-коммит, иначе предыдущий', () => {
  const root = mkdtempSync(join(tmpdir(), 'docdd-doc-diff-'));
  const env = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
  const git = (...args: string[]) => execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', '-C', root, ...args], { env, encoding: 'utf8' }).trim();
  const task = (status: string, body: string) => ['---', 'id: T-0001', 'type: task', 'title: Т', `status: ${status}`, 'created: 2026-10-01', 'updated: 2026-10-01', '---', '', body, ''].join(LF);
  const path = join(root, 'docs', 'development', 'tasks', 'T-0001-t.md');
  const save = (text: string, message: string) => {
    writeFileSync(path, text, 'utf8');
    git('add', '-A');
    git('commit', '-q', '-m', message);
    return git('rev-parse', 'HEAD');
  };

  it('модель правила и закоммитила (файл равен HEAD): база — последняя версия, отличная от рабочей, approved в приоритете', async () => {
    mkdirSync(join(root, 'docs', 'development', 'tasks'), { recursive: true });
    writeFileSync(join(root, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  tasks: tasks', ''].join(LF), 'utf8');
    git('init', '-q');
    const approved = save(task('approved', 'утверждено'), 'approved');
    save(task('draft', 'черновик модели'), 'draft');
    save(task('review', 'на подтверждении'), 'review'); // рабочий файл = HEAD

    const diff = await recordDiff(root, 'T-0001');
    expect(diff?.base).toEqual({ commit: approved, reason: 'approved' });
    expect(diff?.text.some((line) => line.kind === 'del' && line.text === 'утверждено')).toBe(true);
    expect(diff?.text.some((line) => line.kind === 'add' && line.text === 'на подтверждении')).toBe(true);
  });

  it('approved нет вовсе: база — предыдущая отличающаяся версия', async () => {
    const other = mkdtempSync(join(tmpdir(), 'docdd-doc-diff2-'));
    mkdirSync(join(other, 'docs', 'development', 'tasks'), { recursive: true });
    writeFileSync(join(other, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  tasks: tasks', ''].join(LF), 'utf8');
    const g = (...args: string[]) => execFileSync('git', ['-c', 'safe.directory=*', '-C', other, ...args], { env, encoding: 'utf8' }).trim();
    g('init', '-q');
    const file = join(other, 'docs', 'development', 'tasks', 'T-0001-t.md');
    writeFileSync(file, task('draft', 'раз'), 'utf8');
    g('add', '-A'); g('commit', '-q', '-m', 'a');
    const first = g('rev-parse', 'HEAD');
    writeFileSync(file, task('review', 'два'), 'utf8');
    g('add', '-A'); g('commit', '-q', '-m', 'b');

    const diff = await recordDiff(other, 'T-0001');
    expect(diff?.base).toEqual({ commit: first, reason: 'previous' });
    expect(diff?.fields).toEqual([{ field: 'status', before: 'draft', after: 'review' }]);
  });

  it('неподтверждённая правка человека поверх HEAD видна как разница с approved', async () => {
    writeFileSync(path, task('review', 'правка человека'), 'utf8');
    const diff = await recordDiff(root, 'T-0001');
    expect(diff?.base?.reason).toBe('approved');
    expect(diff?.text.some((line) => line.kind === 'add' && line.text === 'правка человека')).toBe(true);
    expect(diff?.empty).toBe(false);
  });
});
