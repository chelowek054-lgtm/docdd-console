import { slugify } from './scaffold';

/**
 * Имена ветки и рабочего дерева задачи (docs/09-execution.md). Чистые функции:
 * по одной и той же записи всегда получается одно и то же имя, поэтому
 * повторный заход находит ту же ветку, а не заводит вторую.
 */

/** Все ветки задач лежат под одним корнем: их видно в `git branch` одним взглядом. */
export const BRANCH_PREFIX = 'docdd';

/** Рабочие деревья — внутри проекта: сервер не выходит за корень. */
export const WORKTREE_DIR = '.docdd/worktrees';

export function branchName(id: string, title: string): string {
  return `${BRANCH_PREFIX}/${id}-${slugify(title, 40)}`;
}

export function worktreePath(id: string): string {
  return `${WORKTREE_DIR}/${id}`;
}

/** Из имени ветки обратно в идентификатор: по нему связываются ветка и запись. */
export function recordOfBranch(branch: string): string | null {
  const match = new RegExp(`^${BRANCH_PREFIX}/([RDACTPVM]-\\d{4})`).exec(branch);
  return match?.[1] ?? null;
}

export function isWorkBranch(branch: string): boolean {
  return branch.startsWith(`${BRANCH_PREFIX}/`);
}

/**
 * Сообщение коммита. Идентификатор впереди: в `git log` видно, какой записью
 * объясняется изменение, без похода в трекер, которого нет.
 */
export function commitMessage(id: string, title: string, round: number): string {
  const suffix = round > 1 ? ` (заход ${round})` : '';
  return `${id}: ${title}${suffix}`;
}

/**
 * Починка нарушений идёт своей веткой и своим деревом
 * (docs/adr/0010-model-fixes-violations.md). Записи-задачи у неё нет, поэтому
 * имя постоянное: починка одна за раз, и вторую заводить незачем.
 */
export const FIX_ID = 'fix';

export const FIX_BRANCH = `${BRANCH_PREFIX}/fix-violations`;

/** Сообщение коммита починки: по нему в `git log` видно, что и по скольким записям. */
export function fixCommitMessage(codes: readonly string[], records: number): string {
  const what = codes.length ? codes.join(', ') : 'нарушения';
  return `Починка: ${what} (записей: ${records})`;
}
