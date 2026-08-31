import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { branchName } from '../server/lib/branch';
import { buildIndex } from '../server/lib/indexer';
import { changesIn, currentBranch, ensureWorktree, isClean, worktreeRoot } from '../server/utils/git';
import { accept, workState } from '../server/utils/work-service';

/**
 * Выполнение задачи на настоящем репозитории: ветка, дифф, слияние перемоткой.
 * Здесь проверяется главный предохранитель — дифф с изменениями записей
 * процесса не сливается (docs/adr/0009-work-through-console.md).
 */

const LF = String.fromCharCode(10);
let root = '';

function run(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
}

function record(id: string, type: string, title: string, extra = ''): string {
  return [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `title: ${title}`,
    `status: ${type === 'task' ? 'ready' : 'approved'}`,
    'created: 2026-08-01',
    'updated: 2026-08-01',
    extra,
    '---',
    '',
    `# ${title}`,
    '',
    'Текст записи.',
    '',
    '## Журнал',
    '',
    '- 2026-08-01 · заведена · architect',
    ''
  ].filter((line) => line !== '').join(LF);
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'docdd-work-'));
  mkdirSync(join(root, 'docs', 'development', 'tasks'), { recursive: true });
  mkdirSync(join(root, 'docs', 'development', 'requirements'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });

  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1',
    'project:',
    '  id: demo',
    '  name: Demo',
    'paths:',
    '  requirements: requirements',
    '  tasks: tasks',
    ''
  ].join(LF), 'utf8');

  writeFileSync(
    join(root, 'docs', 'development', 'requirements', 'R-0001-a.md'),
    record('R-0001', 'requirement', 'Первое требование'),
    'utf8'
  );
  writeFileSync(
    join(root, 'docs', 'development', 'tasks', 'T-0001-a.md'),
    record('T-0001', 'task', 'Первая задача', `links:${LF}  implements: [R-0001]`),
    'utf8'
  );
  writeFileSync(join(root, 'src', 'main.ts'), 'export const value = 1;' + LF, 'utf8');
  writeFileSync(join(root, '.gitignore'), '.docdd/' + LF, 'utf8');

  run(root, ['init', '-b', 'main']);
  run(root, ['config', 'user.email', 'test@example.com']);
  run(root, ['config', 'user.name', 'Тест']);
  run(root, ['add', '-A']);
  run(root, ['commit', '-m', 'начало']);
});

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // Windows иногда держит файлы рабочего дерева — прибирать не обязательно.
  }
});

describe('работа над задачей', () => {
  it('заводит ветку задачи и отдельное дерево, не трогая рабочий каталог', async () => {
    const base = await currentBranch(root);
    expect(base).toBe('main');

    const branch = branchName('T-0001', 'Первая задача');
    const created = await ensureWorktree(root, branch, '.docdd/worktrees/T-0001', base as string);
    expect(created.ok, created.stderr).toBe(true);

    // Ваш каталог остался чистым: работа идёт в стороне.
    expect(await isClean(root)).toBe(true);
  }, 60_000);

  it('видит изменения модели, включая новые файлы', async () => {
    const tree = worktreeRoot(root, 'T-0001');
    writeFileSync(join(tree, 'src', 'main.ts'), 'export const value = 2;' + LF, 'utf8');
    writeFileSync(join(tree, 'src', 'added.ts'), 'export const added = true;' + LF, 'utf8');

    const changes = await changesIn(tree);
    expect(changes.files).toContain('src/main.ts');
    expect(changes.files).toContain('src/added.ts');
    expect(changes.diff).toContain('value = 2');
  }, 60_000);

  it('принимает дифф: коммит в ветку и слияние перемоткой', async () => {
    const { index } = buildIndex(root);
    const task = index.records.find((item) => item.id === 'T-0001');
    expect(task).toBeDefined();

    const outcome = await accept(root, task!, 'architect');
    expect(outcome.ok, outcome.ok ? '' : `${outcome.code}: ${outcome.message}`).toBe(true);

    // Изменение доехало до вашей ветки.
    const merged = run(root, ['show', 'HEAD:src/main.ts']);
    expect(merged).toContain('value = 2');
    expect(run(root, ['log', '--oneline', '-1'])).toContain('T-0001');
  }, 120_000);

  it('дифф с записями процесса не сливается: подтверждение остаётся за человеком', async () => {
    const tree = worktreeRoot(root, 'T-0001');
    // Модель «подтверждает» себе требование — ровно то, что нельзя.
    writeFileSync(
      join(tree, 'docs', 'development', 'requirements', 'R-0001-a.md'),
      record('R-0001', 'requirement', 'Первое требование').replace('status: approved', 'status: draft'),
      'utf8'
    );

    const { index } = buildIndex(root);
    const task = index.records.find((item) => item.id === 'T-0001');
    const state = await workState(root, task!, '');
    expect(state.forbidden).toContain('docs/development/requirements/R-0001-a.md');

    const outcome = await accept(root, task!, 'architect');
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('process_records_touched');
  }, 120_000);
});
