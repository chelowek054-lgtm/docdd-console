// V-0068
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { applyStatusChange } from '../server/lib/actions';
import { diffRecordTexts, lineDiff } from '../server/lib/record-diff';
import { markViewed, recordDiff, unviewedReview, wasViewed } from '../server/utils/record-diff-service';

/** R-0068: «было» из git на последнем approved-коммите, отметка просмотра по хэшу файла, слова журнала. Временный git-репозиторий. */

const LF = String.fromCharCode(10);
const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' };
let root = '';
const git = (...args: string[]) => execFileSync('git', ['-c', 'safe.directory=*', '-c', 'core.autocrlf=false', '-C', root, ...args], { env: GIT_ENV, encoding: 'utf8' }).trim();

const dep = ['links:', '  depends_on: [T-0009]'].join(LF);
const impl = ['links:', '  implements: [R-0001]'].join(LF);

function task(id: string, status: string, body: string, links = ''): string {
  return ['---', `id: ${id}`, 'type: task', `title: Задача ${id}`, `status: ${status}`, 'created: 2026-10-01', 'updated: 2026-10-01', ...(links ? [links] : []), '---', '', body, ''].join(LF);
}
const file = (id: string) => join(root, 'docs', 'development', 'tasks', `${id}-t.md`);
const rel = (id: string) => `docs/development/tasks/${id}-t.md`;
function commit(id: string, text: string, message: string): string {
  writeFileSync(file(id), text, 'utf8');
  git('add', '-A');
  git('commit', '-q', '-m', message);
  return git('rev-parse', 'HEAD');
}

let approvedCommit = '';
let firstCommit = '';

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-rdiff-'));
  mkdirSync(join(root, 'docs', 'development', 'tasks'), { recursive: true });
  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), ['contract: docdd.workspace/1', 'project:', '  id: demo', '  name: Demo', 'paths:', '  tasks: tasks', ''].join(LF), 'utf8');
  git('init', '-q');
  // T-0001: draft, approved, правка в draft, потом текущий файл на подтверждении
  firstCommit = commit('T-0001', task('T-0001', 'draft', 'Первая версия', dep), 'draft');
  approvedCommit = commit('T-0001', task('T-0001', 'approved', 'Утверждённая версия', dep), 'approved');
  commit('T-0001', task('T-0001', 'draft', 'Промежуточная правка', dep), 'edit');
  // T-0002: только черновики, approved не было
  commit('T-0002', task('T-0002', 'draft', 'Раз'), 'a');
  commit('T-0002', task('T-0002', 'draft', 'Два'), 'b');
  // T-0003: ещё не в git
  writeFileSync(file('T-0003'), task('T-0003', 'review', 'Новая'), 'utf8');
  writeFileSync(file('T-0001'), task('T-0001', 'review', 'Новая версия', impl), 'utf8');
});

describe('«было» берётся из git', () => {
  it('последний коммит со статусом approved, а не предыдущий', async () => {
    const diff = await recordDiff(root, 'T-0001');
    expect(diff?.base).toEqual({ commit: approvedCommit, reason: 'approved' });
    expect(diff?.base?.commit).not.toBe(firstCommit);
    expect(diff?.text.filter((line) => line.kind !== 'same').map((line) => `${line.kind}:${line.text}`)).toEqual(['del:Утверждённая версия', 'add:Новая версия']);
    expect(diff?.fields).toEqual([{ field: 'status', before: 'approved', after: 'review' }]);
    expect(diff?.links).toEqual([
      { sign: '+', kind: 'implements', target: 'R-0001' },
      { sign: '-', kind: 'depends_on', target: 'T-0009' }
    ]);
    expect(diff?.empty).toBe(false);
  });

  it('approved не было — предыдущий коммит, отличный от рабочего файла', async () => {
    const diff = await recordDiff(root, 'T-0002');
    expect(diff?.base?.reason).toBe('previous');
  });

  it('запись, которой нет в git — kind new, базы нет', async () => {
    const diff = await recordDiff(root, 'T-0003');
    expect(diff).toMatchObject({ kind: 'new', base: null });
  });

  it('неизвестная запись — null; своей базы снимков не заводится', async () => {
    expect(await recordDiff(root, 'T-9999')).toBeNull();
    expect(existsSync(join(root, '.docdd', 'snapshots'))).toBe(false);
  });

  it('вне git-репозитория базы нет, но падения нет', async () => {
    const plain = mkdtempSync(join(tmpdir(), 'docdd-nogit-'));
    mkdirSync(join(plain, 'docs', 'development', 'tasks'), { recursive: true });
    writeFileSync(join(plain, 'docs', 'development', 'project.yaml'), readFileSync(join(root, 'docs', 'development', 'project.yaml')));
    writeFileSync(join(plain, 'docs', 'development', 'tasks', 'T-0001-t.md'), task('T-0001', 'review', 'x'), 'utf8');
    expect((await recordDiff(plain, 'T-0001'))?.base).toBeNull();
  });
});

describe('для каждого типа записи — разница по тексту и полям', () => {
  it('requirement, design, decision, contract, verification, phase, task: те же поля и текст', () => {
    for (const type of ['requirement', 'design', 'decision', 'contract', 'verification', 'phase', 'task']) {
      const was = ['---', 'id: X-1', `type: ${type}`, 'status: draft', '---', '', 'a', ''].join(LF);
      const now = ['---', 'id: X-1', `type: ${type}`, 'status: review', '---', '', 'b', ''].join(LF);
      const diff = diffRecordTexts('X-1', type, was, now);
      expect(diff.kind).toBe('text');
      expect(diff.fields).toEqual([{ field: 'status', before: 'draft', after: 'review' }]);
      expect(diff.text.some((line) => line.kind === 'add' && line.text === 'b')).toBe(true);
    }
  });
  it('совпадающие версии — empty', () => {
    const text = task('T-1', 'review', 'x');
    expect(diffRecordTexts('T-1', 'task', text, text).empty).toBe(true);
  });
  it('lineDiff: общая, убранная и добавленная строки', () => {
    expect(lineDiff('a\nb', 'a\nc').map((line) => line.kind)).toEqual(['same', 'del', 'add']);
  });
});

describe('отметка просмотра и журнал', () => {
  it('список «на подтверждении» показывает не открывавшиеся; отметка снимает значок', () => {
    expect(unviewedReview(root).sort()).toEqual(['T-0001', 'T-0003']);
    markViewed(root, 'T-0001', rel('T-0001'));
    expect(wasViewed(root, 'T-0001', rel('T-0001'))).toBe(true);
    expect(unviewedReview(root)).toEqual(['T-0003']);
  });
  it('отметка привязана к хэшу файла: правка после просмотра её обнуляет', () => {
    markViewed(root, 'T-0001', rel('T-0001'));
    writeFileSync(file('T-0001'), task('T-0001', 'review', 'Ещё правка', impl), 'utf8');
    expect(wasViewed(root, 'T-0001', rel('T-0001'))).toBe(false);
    expect(unviewedReview(root)).toContain('T-0001');
  });
  it('отметка лежит в .docdd/diff-viewed.json и не трогает файл записи', () => {
    const before = readFileSync(file('T-0003'), 'utf8');
    markViewed(root, 'T-0003', rel('T-0003'));
    expect(existsSync(join(root, '.docdd', 'diff-viewed.json'))).toBe(true);
    expect(readFileSync(file('T-0003'), 'utf8')).toBe(before);
  });
  it('путь за пределы корня отказывается', () => {
    expect(() => markViewed(root, 'T-0001', '../../outside.md')).toThrow();
  });
  it('строка журнала «подтверждено после просмотра разницы» — только с этим действием', () => {
    const text = task('T-0003', 'review', 'Новая') + '## Журнал' + LF + LF + '- 2026-10-01 · заведена · приложение' + LF;
    const viewed = applyStatusChange(text, { status: 'approved', actor: 'architect', today: '2026-10-21', action: 'подтверждено после просмотра разницы' });
    expect(viewed.problems).toEqual([]);
    expect(viewed.text).toContain('· подтверждено после просмотра разницы · architect');
    const plain = applyStatusChange(text, { status: 'approved', actor: 'architect', today: '2026-10-21' });
    expect(plain.text).not.toContain('после просмотра разницы');
  });
});
