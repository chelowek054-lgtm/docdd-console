import { execFile, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { WORKTREE_DIR } from '../lib/branch';
import { normalizeRoot } from '../lib/paths';

/**
 * Работа с git. Приложение делает ровно три вещи: заводит ветку задачи,
 * коммитит принятое и сливает перемоткой
 * (docs/adr/0009-work-through-console.md). Ни переписывания истории, ни
 * удаления веток, ни отправки на сервер здесь нет и не будет.
 */

export interface GitResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
}

const TIMEOUT = 60_000;

export function git(root: string, args: readonly string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    execFile(
      'git',
      ['-C', normalizeRoot(root), ...args],
      { timeout: TIMEOUT, maxBuffer: 8 * 1024 * 1024, encoding: 'utf8', windowsHide: true },
      (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: stdout ?? '',
          stderr: stderr ?? '',
          code: error ? ((error as { code?: number }).code ?? 1) : 0
        });
      }
    );
  });
}

export async function isRepository(root: string): Promise<boolean> {
  const result = await git(root, ['rev-parse', '--is-inside-work-tree']);
  return result.ok && result.stdout.trim() === 'true';
}

/**
 * Ветка, на которой стоит проект. От неё заводится ветка задачи, в неё же
 * потом сливается: «куда вернём» и «откуда взяли» должны совпадать.
 */
export async function currentBranch(root: string): Promise<string | null> {
  const result = await git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const name = result.stdout.trim();
  return result.ok && name && name !== 'HEAD' ? name : null;
}

/** Чистое дерево — условие слияния: иначе чужие правки попадут под перемотку. */
export async function isClean(root: string): Promise<boolean> {
  const result = await git(root, ['status', '--porcelain']);
  return result.ok && result.stdout.trim() === '';
}

export async function branchExists(root: string, branch: string): Promise<boolean> {
  const result = await git(root, ['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`]);
  return result.ok && result.stdout.trim() !== '';
}

export async function listWorkBranches(root: string): Promise<string[]> {
  const result = await git(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/docdd/']);
  return result.ok ? result.stdout.split(/\r?\n/).filter((line) => line.trim() !== '') : [];
}

/**
 * Ветка и отдельное рабочее дерево под задачу. Каталог уже есть — значит заход
 * повторный, и это нормальный случай: доработка идёт там же.
 *
 * Каталога нет, а git о нём помнит — тоже случай не редкий: `.docdd` удалили
 * руками, а запись о дереве осталась в служебных файлах. Без уборки git
 * откажется заводить дерево заново, сказав «ветка уже занята деревом», и работа
 * встанет на пустом месте.
 */
export async function ensureWorktree(
  root: string,
  branch: string,
  relativePath: string,
  base: string
): Promise<GitResult> {
  const absolute = join(normalizeRoot(root), relativePath);
  if (existsSync(absolute)) {
    return { ok: true, stdout: 'рабочее дерево уже есть', stderr: '', code: 0 };
  }

  // Прибираем записи о деревьях, каталогов которых больше нет. Существующие
  // деревья это не трогает: git убирает только заведомо пропавшие.
  await git(root, ['worktree', 'prune']);

  const exists = await branchExists(root, branch);
  return exists
    ? git(root, ['worktree', 'add', relativePath, branch])
    : git(root, ['worktree', 'add', '-b', branch, relativePath, base]);
}

export interface WorkChanges {
  /** Пути изменённых файлов относительно корня проекта. */
  files: string[];
  /** Сам дифф — то, что человек будет читать. */
  diff: string;
}

/**
 * Что модель наработала. `--intent-to-add` показывает и новые файлы, но ничего
 * не индексирует: приложение читает дерево, а не меняет его состояние.
 */
export async function changesIn(worktree: string): Promise<WorkChanges> {
  await git(worktree, ['add', '--intent-to-add', '--all']);

  const status = await git(worktree, ['status', '--porcelain']);
  const files = status.stdout
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '')
    .map((line) => line.slice(3).trim().split(' -> ').pop() ?? '')
    .filter((path) => path !== '');

  const diff = await git(worktree, ['diff', '--no-color']);
  return { files, diff: diff.stdout };
}

export async function commitAll(worktree: string, message: string): Promise<GitResult> {
  const added = await git(worktree, ['add', '--all']);
  if (!added.ok) return added;
  return git(worktree, ['commit', '--no-verify', '-m', message]);
}

/** Слияние только перемоткой: расхождение разбирает человек, а не приложение. */
export async function mergeFastForward(root: string, branch: string): Promise<GitResult> {
  return git(root, ['merge', '--ff-only', branch]);
}

/** Рабочее дерево задачи, если оно заведено. */
export function worktreeRoot(root: string, id: string): string {
  return join(normalizeRoot(root), WORKTREE_DIR, id);
}

export async function hasWorktree(root: string, id: string): Promise<boolean> {
  return existsSync(worktreeRoot(root, id));
}

/**
 * Синхронный взгляд в git — для сборки индекса: она проходит по файлам разом и
 * ждать асинхронных вызовов ей негде. Отказ git не должен ронять индекс, поэтому
 * ошибка означает «нечего показать», а не исключение.
 */
function gitSync(root: string, args: readonly string[]): string {
  try {
    return execFileSync('git', ['-C', normalizeRoot(root), ...args], {
      encoding: 'utf8',
      timeout: 15_000,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return '';
  }
}

export function workBranchesSync(root: string): string[] {
  return splitLines(gitSync(root, ['for-each-ref', '--format=%(refname:short)', 'refs/heads/docdd/']));
}

/** Перенос строки константой: экранированный в этом файле уже один раз съели. */
const CARRIAGE_RETURN = String.fromCharCode(13);
const NEW_LINE = String.fromCharCode(10);

function splitLines(text: string): string[] {
  return text
    .split(NEW_LINE)
    .map((line) => line.replace(CARRIAGE_RETURN, ''))
    .filter((line) => line.trim() !== '');
}

/** Есть ли в дереве задачи неразобранные изменения. */
export function hasChangesSync(root: string, id: string): boolean {
  const tree = worktreeRoot(root, id);
  if (!existsSync(tree)) return false;
  return gitSync(tree, ['status', '--porcelain']).trim() !== '';
}
