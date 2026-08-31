import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { FIX_BRANCH, FIX_ID, fixCommitMessage, worktreePath } from '../server/lib/branch';
import { buildIndex } from '../server/lib/indexer';
import { currentBranch, ensureWorktree, worktreeRoot } from '../server/utils/git';
import { acceptFix, approvedIn, borderOf, fixPrompt, fixState } from '../server/utils/fix-service';

/**
 * Починка нарушений моделью (docs/adr/0010-model-fixes-violations.md).
 * Здесь проверяются оба предохранителя: тронутое сверх плана и подтверждение,
 * поставленное моделью. Границу приложение считает само — на слово модели тут
 * никто не верит.
 */

const LF = String.fromCharCode(10);
let root = '';

function run(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
}

function record(id: string, type: string, title: string, status: string): string {
  return [
    '---',
    `id: ${id}`,
    `type: ${type}`,
    `title: ${title}`,
    `status: ${status}`,
    'created: 2026-08-01',
    'updated: 2026-08-01',
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
  ].join(LF);
}

const BROKEN = join('docs', 'development', 'design', 'D-0009-status.md');
const OTHER = join('src', 'main.ts');

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'docdd-fix-'));
  mkdirSync(join(root, 'docs', 'development', 'design'), { recursive: true });
  mkdirSync(join(root, 'src'), { recursive: true });

  writeFileSync(join(root, 'docs', 'development', 'project.yaml'), [
    'contract: docdd.workspace/1',
    'project:',
    '  id: demo',
    '  name: Demo',
    'paths:',
    '  design: design',
    ''
  ].join(LF), 'utf8');

  // Запись с недопустимым статусом: то самое нарушение, ради которого всё.
  writeFileSync(join(root, BROKEN), record('D-0009', 'design', 'Статусы', 'в работе'), 'utf8');
  writeFileSync(join(root, OTHER), 'export const value = 1;' + LF, 'utf8');
  writeFileSync(join(root, '.gitignore'), '.docdd/' + LF, 'utf8');

  run(root, ['init', '-b', 'main']);
  run(root, ['config', 'user.email', 'test@example.com']);
  run(root, ['config', 'user.name', 'Тест']);
  run(root, ['add', '-A']);
  run(root, ['commit', '-m', 'начало']);

  const base = await currentBranch(root);
  await ensureWorktree(root, FIX_BRANCH, worktreePath(FIX_ID), base as string);
});

afterAll(() => {
  try {
    rmSync(root, { recursive: true, force: true });
  } catch {
    // Windows иногда держит файлы рабочего дерева — прибирать не обязательно.
  }
});

/** Правка в дереве починки: так это делала бы модель. */
function modelWrites(file: string, text: string): void {
  writeFileSync(join(worktreeRoot(root, FIX_ID), file), text, 'utf8');
}

function resetTree(): void {
  const tree = worktreeRoot(root, FIX_ID);
  run(tree, ['checkout', '--', '.']);
  run(tree, ['clean', '-fd']);
}

describe('граница починки', () => {
  it('берётся из самих нарушений, а не из запроса браузера', () => {
    const { index } = buildIndex(root);
    const border = borderOf(index, [], '');

    // Файл с нарушением в границе, и код нарушения при нём.
    const key = [...border.keys()].find((path) => path.includes('D-0009'));
    expect(key).toBeDefined();
    expect(border.get(key as string)).toContain('schema_invalid');
    // Файла без нарушений в границе нет.
    expect([...border.keys()].some((path) => path.includes('main.ts'))).toBe(false);
  });
});

describe('предохранители', () => {
  it('тронутое сверх плана не сливается', async () => {
    modelWrites(BROKEN.split('\\').join('/'), record('D-0009', 'design', 'Статусы', 'draft'));
    modelWrites(OTHER.split('\\').join('/'), 'export const value = 2;' + LF);

    const allowed = ['docs/development/design/D-0009-status.md'];
    const state = await fixState(root, allowed);
    expect(state.foreign).toContain('src/main.ts');

    const outcome = await acceptFix(root, { allowed, codes: new Map(), actor: 'architect' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('foreign_files_touched');

    resetTree();
  }, 60_000);

  it('подтверждение, поставленное моделью, не сливается', async () => {
    modelWrites(BROKEN.split('\\').join('/'), record('D-0009', 'design', 'Статусы', 'approved'));

    const allowed = ['docs/development/design/D-0009-status.md'];
    const state = await fixState(root, allowed);
    expect(state.approvals).toContain('docs/development/design/D-0009-status.md');

    const outcome = await acceptFix(root, { allowed, codes: new Map(), actor: 'architect' });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.code).toBe('approval_by_model');

    resetTree();
  }, 60_000);

  it('подтверждение узнаётся в диффе, как бы оно ни было записано', () => {
    const diff = [
      '+++ b/docs/development/design/D-0009-status.md',
      "+status: 'approved'",
      '+++ b/docs/development/tasks/T-0001-a.md',
      '+status: draft'
    ].join(LF);

    expect(approvedIn(diff)).toEqual(['docs/development/design/D-0009-status.md']);
  });
});

describe('принятая починка', () => {
  it('сливается перемоткой и оставляет след в журнале', async () => {
    modelWrites(BROKEN.split('\\').join('/'), record('D-0009', 'design', 'Статусы', 'draft'));

    const allowed = ['docs/development/design/D-0009-status.md'];
    const codes = new Map([
      ['docs/development/design/D-0009-status.md', ['schema_invalid']],
      // Файл из границы, которого модель не касалась: в коммит попасть не должен.
      ['docs/development/tasks/T-0001-a.md', ['link_broken']]
    ]);

    const outcome = await acceptFix(root, { allowed, codes, actor: 'architect' });
    expect(outcome.ok, outcome.ok ? '' : `${outcome.code}: ${outcome.message}`).toBe(true);

    // Починка доехала до вашей ветки.
    const merged = readFileSync(join(root, BROKEN), 'utf8');
    expect(merged).toContain('status: draft');

    // И объяснила себя в журнале: что чинили.
    expect(merged).toContain('починено schema_invalid');
    expect(merged).toContain('architect');

    const message = run(root, ['log', '--oneline', '-1']);
    expect(message).toContain('schema_invalid');
    // Только то, что правда чинили: коды нетронутых файлов в сообщении не нужны.
    expect(message).not.toContain('link_broken');
  }, 120_000);
});

describe('запрос на починку', () => {
  it('несёт план и границу: модель видит, что ей можно', () => {
    const template = ['# Заголовок', '<!-- ПЛАН -->', '## Что можно трогать', '<!-- ФАЙЛЫ -->'].join(LF);
    const prompt = fixPrompt(template, 'Поменять status на draft', ['docs/development/design/D-0009-status.md']);

    expect(prompt).toContain('Поменять status на draft');
    expect(prompt).toContain('`docs/development/design/D-0009-status.md`');
    expect(prompt).not.toContain('<!-- ПЛАН -->');
  });
});

describe('сообщение коммита', () => {
  it('называет коды и число записей: в git log видно, что чинили', () => {
    expect(fixCommitMessage(['schema_invalid', 'link_broken'], 2)).toBe(
      'Починка: schema_invalid, link_broken (записей: 2)'
    );
  });
});
