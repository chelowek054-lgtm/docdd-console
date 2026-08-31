import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { applyJournalNote } from '../lib/actions';
import { FIX_BRANCH, FIX_ID, fixCommitMessage, worktreePath } from '../lib/branch';
import { normalizeRoot } from '../lib/paths';
import type { ModelEvent } from '../lib/stream-events';
import { DEVELOPMENT_DIR, type ProjectIndex } from '../lib/types';
import {
  changesIn,
  commitAll,
  currentBranch,
  ensureWorktree,
  isClean,
  isRepository,
  mergeFastForward,
  worktreeRoot
} from './git';
import { ask } from './llm';
import { today } from './record-write';

/**
 * Починка нарушений моделью по подтверждённому человеком плану
 * (docs/adr/0010-model-fixes-violations.md).
 *
 * Отличие от работы над задачей одно и важное: здесь модели можно править
 * записи процесса — потому что человек сам показал на нарушение и подтвердил
 * починку. Всё остальное так же: своё дерево, дифф, слияние по подтверждению.
 */

export const PLAN_MARKER = '<!-- ПЛАН -->';
export const FILES_MARKER = '<!-- ФАЙЛЫ -->';

const NEW_LINE = String.fromCharCode(10);
const CARRIAGE_RETURN = String.fromCharCode(13);

export interface FixState {
  started: boolean;
  branch: string;
  files: string[];
  /** Тронутое сверх границы: слияние такого отклоняется. */
  foreign: string[];
  /** Подтверждение, поставленное моделью: то, чего она делать не вправе. */
  approvals: string[];
  diff: string;
}

export type FixOutcome =
  | { ok: true; state: FixState; answer?: string }
  | { ok: false; code: string; message: string; detail?: string };

/** Так выглядит подтверждение записи в диффе — что бы его ни поставило. */
const APPROVED_LINE = /^\+\s*status:\s*['"]?approved['"]?\s*$/;

export function fixPrompt(template: string, plan: string, files: readonly string[]): string {
  return template
    .replace(PLAN_MARKER, plan.trim())
    .replace(FILES_MARKER, files.map((file) => '- `' + file + '`').join(NEW_LINE));
}

/**
 * Что модель наработала и не вышла ли она за границу. Границу приложение знает
 * само: это файлы нарушений, из которых собран план.
 */
export async function fixState(root: string, allowed: readonly string[]): Promise<FixState> {
  const normalized = normalizeRoot(root);
  const tree = worktreeRoot(normalized, FIX_ID);
  const empty: FixState = { started: false, branch: FIX_BRANCH, files: [], foreign: [], approvals: [], diff: '' };

  if (!existsSync(tree)) return empty;

  const changes = await changesIn(tree);
  const border = new Set(allowed);

  return {
    started: true,
    branch: FIX_BRANCH,
    files: changes.files,
    foreign: allowed.length ? changes.files.filter((file) => !border.has(file)) : [],
    approvals: approvedIn(changes.diff),
    diff: changes.diff
  };
}

/** Файлы, в которых модель поставила `approved`. Ищем в диффе, а не на слово. */
export function approvedIn(diff: string): string[] {
  const found: string[] = [];
  let file = '';

  for (const raw of diff.split(NEW_LINE)) {
    const line = raw.replace(CARRIAGE_RETURN, '');
    const header = /^\+\+\+ b\/(.+)$/.exec(line);
    if (header?.[1]) file = header[1];
    if (APPROVED_LINE.test(line) && file && !found.includes(file)) found.push(file);
  }

  return found;
}

/** Отдать модели подтверждённый план. Без плана и без границы не начинаем. */
export async function startFix(
  root: string,
  options: {
    plan: string;
    files: readonly string[];
    template: string;
    signal?: AbortSignal;
    onEvent?: (event: ModelEvent) => void;
  }
): Promise<FixOutcome> {
  const normalized = normalizeRoot(root);

  if (options.plan.trim() === '') {
    return {
      ok: false,
      code: 'plan_required',
      message: 'Плана нет — чинить нечего. Спросите модель и подтвердите ответ'
    };
  }
  if (options.files.length === 0) {
    return {
      ok: false,
      code: 'files_required',
      message: 'Не названо ни одного файла: без границы починка не начинается'
    };
  }
  if (!(await isRepository(normalized))) {
    return { ok: false, code: 'not_a_repository', message: 'Проект не под git: приложение чинит веткой, а её негде завести' };
  }

  const base = await currentBranch(normalized);
  if (!base) {
    return { ok: false, code: 'detached_head', message: 'Проект не на ветке: непонятно, откуда заводить ветку починки' };
  }

  const created = await ensureWorktree(normalized, FIX_BRANCH, worktreePath(FIX_ID), base);
  if (!created.ok) {
    return {
      ok: false,
      code: 'worktree_failed',
      message: 'Не удалось завести рабочее дерево починки',
      detail: created.stderr.trim()
    };
  }

  const answer = await ask(fixPrompt(options.template, options.plan, options.files), {
    cwd: worktreeRoot(normalized, FIX_ID),
    // План подтверждён — значит модели тут писать. Спросить разрешение
    // посреди работы не у кого: запрос идёт без консоли.
    access: 'edits',
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onEvent ? { onEvent: options.onEvent } : {})
  });

  if (!answer.ok) {
    return {
      ok: false,
      code: `llm_${answer.failure.code}`,
      message: answer.failure.message,
      ...(answer.failure.detail ? { detail: answer.failure.detail } : {})
    };
  }

  return { ok: true, state: await fixState(normalized, options.files), answer: answer.answer };
}

/**
 * Принять починку: журнал, коммит, слияние перемоткой. Предохранители стоят
 * здесь, а не в тексте запроса: границу, которую можно нарушить уговором,
 * границей считать нельзя.
 */
export async function acceptFix(
  root: string,
  options: { allowed: readonly string[]; codes: ReadonlyMap<string, string[]>; actor: string }
): Promise<FixOutcome> {
  const normalized = normalizeRoot(root);
  const state = await fixState(normalized, options.allowed);

  if (!state.started || state.files.length === 0) {
    return { ok: false, code: 'nothing_to_accept', message: 'Принимать нечего: модель ничего не изменила' };
  }
  if (state.foreign.length > 0) {
    return {
      ok: false,
      code: 'foreign_files_touched',
      message: `Тронуто сверх плана: ${state.foreign.join(', ')}. Починка принимается только по тем файлам, что были в нарушениях`
    };
  }
  if (state.approvals.length > 0) {
    return {
      ok: false,
      code: 'approval_by_model',
      message: `Модель подтвердила записи сама: ${state.approvals.join(', ')}. Подтверждение — действие человека, и починка с ним не принимается`
    };
  }
  if (!(await isClean(normalized))) {
    return {
      ok: false,
      code: 'workspace_dirty',
      message: 'В вашем каталоге есть несохранённые изменения: слияние перемоткой их заденет'
    };
  }

  // След в журнале пишет приложение и берёт его из кода нарушения, а не из
  // пересказа модели (docs/adr/0010-model-fixes-violations.md).
  const noted = writeJournal(normalized, state.files, options.codes, options.actor);

  // Коды — только тех файлов, которые правда тронуты: сообщение коммита
  // должно говорить, что починено, а не что было в границе.
  const codes = [...new Set(state.files.flatMap((file) => options.codes.get(file) ?? []))];
  const committed = await commitAll(worktreeRoot(normalized, FIX_ID), fixCommitMessage(codes, noted));
  if (!committed.ok) {
    return {
      ok: false,
      code: 'commit_failed',
      message: 'Не удалось записать починку в ветку',
      detail: committed.stderr.trim()
    };
  }

  const merged = await mergeFastForward(normalized, FIX_BRANCH);
  if (!merged.ok) {
    return {
      ok: false,
      code: 'merge_not_fast_forward',
      message: 'Перемоткой не сливается: ветка проекта ушла вперёд. Разберите расхождение сами',
      detail: merged.stderr.trim()
    };
  }

  return { ok: true, state: await fixState(normalized, options.allowed) };
}

/**
 * Строка журнала в каждой починенной записи. Возвращает, скольким записям её
 * удалось дописать: файл вне `docs/development` записью не является, а запись,
 * не принявшая строку, пропускается — ронять принятую починку из-за журнала
 * нельзя.
 */
function writeJournal(
  root: string,
  files: readonly string[],
  codes: ReadonlyMap<string, string[]>,
  actor: string
): number {
  let written = 0;
  const stamp = today();

  for (const file of files) {
    if (!file.startsWith(`${DEVELOPMENT_DIR}/`)) continue;

    const absolute = join(worktreeRoot(root, FIX_ID), file);
    if (!existsSync(absolute)) continue;

    const said = codes.get(file) ?? [];
    const action = said.length ? `починено ${said.join(', ')}` : 'починено нарушение';

    const original = readFileSync(absolute, 'utf8');
    const outcome = applyJournalNote(original, { action, actor, today: stamp });
    if (outcome.problems.length > 0) continue;

    writeFileSync(absolute, outcome.text, 'utf8');
    written += 1;
  }

  return written;
}

/** Отклонить починку: ветка и дерево остаются, разбирается человек. */
export async function rejectFix(root: string, allowed: readonly string[]): Promise<FixOutcome> {
  return { ok: true, state: await fixState(normalizeRoot(root), allowed) };
}

/**
 * Файлы и коды нарушений, попавших под фильтр экрана: это и есть граница
 * починки. Приложение знает её само — оно же собрало и план.
 */
export function borderOf(
  index: ProjectIndex,
  codes: readonly string[],
  severity: string
): Map<string, string[]> {
  const files = new Map<string, string[]>();

  for (const issue of index.issues) {
    if (!issue.path) continue;
    if (severity && issue.severity !== severity) continue;
    if (codes.length && !codes.includes(issue.code)) continue;

    const said = files.get(issue.path) ?? [];
    if (!said.includes(issue.code)) said.push(issue.code);
    files.set(issue.path, said);
  }

  return files;
}
