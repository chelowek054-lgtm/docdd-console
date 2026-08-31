import { readFileSync } from 'node:fs';

import { applyJournalNote } from '../lib/actions';
import { branchName, commitMessage, worktreePath } from '../lib/branch';
import { parseMapRecord } from '../lib/maps';
import { normalizeRoot } from '../lib/paths';
import { taskPrompt, type TaskContext } from '../lib/prompt';
import type { IndexRecord, ProjectIndex } from '../lib/types';
import {
  changesIn,
  commitAll,
  currentBranch,
  ensureWorktree,
  hasWorktree,
  isClean,
  isRepository,
  listWorkBranches,
  mergeFastForward,
  worktreeRoot,
  type WorkChanges
} from './git';
import { ask, WORK_TIMEOUT } from './llm';
import type { ModelEvent } from '../lib/stream-events';
import { buildProjectMap } from './map-service';
import { openRecord, saveRecord, today } from './record-write';

/**
 * Выполнение задачи через клиент (docs/09-execution.md). Приложение заводит
 * ветку, показывает дифф и сливает перемоткой — принимает человек.
 */

/** Записи процесса модели недоступны: их правит приложение, а не она. */
const PROCESS_DIR = 'docs/development/';

export interface WorkState {
  branch: string;
  worktree: string;
  /** Ветка заведена и дерево на месте. */
  started: boolean;
  files: string[];
  diff: string;
  /** Сколько заходов уже было — считается по журналу записи. */
  round: number;
  /** Изменения, которые трогают записи процесса: с ними слияние отклоняется. */
  forbidden: string[];
}

export async function workState(root: string, record: IndexRecord, body: string): Promise<WorkState> {
  const branch = branchName(record.id, record.title);
  const relative = worktreePath(record.id);
  const started = await hasWorktree(root, record.id);

  const changes: WorkChanges = started
    ? await changesIn(worktreeRoot(root, record.id))
    : { files: [], diff: '' };

  return {
    branch,
    worktree: relative,
    started,
    files: changes.files,
    diff: changes.diff,
    round: roundsIn(body),
    forbidden: changes.files.filter((path) => path.startsWith(PROCESS_DIR))
  };
}

/** Каждый заход оставляет строку в журнале — по ним и считаем круги. */
function roundsIn(body: string): number {
  return (body.match(/·\s*отдана модели\s*·/g) ?? []).length;
}

export type WorkOutcome =
  | { ok: true; state: WorkState; answer?: string; note?: string }
  | { ok: false; code: string; message: string; detail?: string };

/**
 * Отдать задачу модели. Ветка и дерево заводятся при первом заходе, при
 * повторном используются те же: доработка идёт там же, где работа.
 */
export async function handover(
  root: string,
  index: ProjectIndex,
  record: IndexRecord,
  options: {
    actor: string;
    rework: string;
    template: string;
    signal?: AbortSignal;
    /** Ход работы модели: уходит на экран лентой. */
    onEvent?: (event: ModelEvent) => void;
  }
): Promise<WorkOutcome> {
  const normalized = normalizeRoot(root);

  if (!await isRepository(normalized)) {
    return { ok: false, code: 'not_a_repository', message: 'Проект не под git: ветку задачи заводить негде' };
  }
  const base = await currentBranch(normalized);
  if (!base) {
    return { ok: false, code: 'detached_head', message: 'Проект не на ветке: непонятно, откуда заводить ветку задачи и куда сливать' };
  }

  const branch = branchName(record.id, record.title);
  const relative = worktreePath(record.id);
  const created = await ensureWorktree(normalized, branch, relative, base);
  if (!created.ok) {
    return { ok: false, code: 'worktree_failed', message: 'Не удалось завести рабочее дерево задачи', detail: created.stderr.trim() };
  }

  const context = await openRecord(normalized, record.id);
  const before = context ? context.original : '';
  const prompt = taskPrompt(
    options.template,
    taskContext(normalized, index, record, before, options.rework, roundsIn(before) + 1)
  );

  // Модель работает в дереве задачи, а не в вашем каталоге.
  const answer = await ask(prompt, {
    cwd: worktreeRoot(normalized, record.id),
    timeoutMs: WORK_TIMEOUT,
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onEvent ? { onEvent: options.onEvent } : {})
  });
  if (!answer.ok) {
    return { ok: false, code: `llm_${answer.failure.code}`, message: answer.failure.message, ...(answer.failure.detail ? { detail: answer.failure.detail } : {}) };
  }

  const note = await journal(normalized, record.id, 'отдана модели', options.actor);
  return { ok: true, state: await workState(normalized, record, readBody(normalized, record)), answer: answer.answer, ...(note ? { note } : {}) };
}

/**
 * Принять дифф: коммит в ветку задачи и слияние перемоткой. Отказ, если модель
 * тронула записи процесса или если `main` ушёл вперёд.
 */
export async function accept(root: string, record: IndexRecord, actor: string): Promise<WorkOutcome> {
  const normalized = normalizeRoot(root);
  const state = await workState(normalized, record, readBody(normalized, record));

  if (!state.started) {
    return { ok: false, code: 'work_not_started', message: 'Задача модели не отдавалась: принимать нечего' };
  }
  if (state.forbidden.length > 0) {
    return {
      ok: false,
      code: 'process_records_touched',
      message: 'В диффе есть изменения записей процесса — слияние отклонено',
      detail: state.forbidden.join(', ')
    };
  }
  if (state.files.length === 0) {
    return { ok: false, code: 'nothing_to_accept', message: 'Модель ничего не изменила: принимать нечего' };
  }
  if (!await isClean(normalized)) {
    return {
      ok: false,
      code: 'workspace_dirty',
      message: 'В рабочем каталоге проекта есть незакоммиченные правки. Разберитесь с ними: слияние перемоткой их затрёт'
    };
  }

  const committed = await commitAll(
    worktreeRoot(normalized, record.id),
    commitMessage(record.id, record.title, state.round)
  );
  if (!committed.ok) {
    return { ok: false, code: 'commit_failed', message: 'Не удалось закоммитить изменения задачи', detail: committed.stderr.trim() };
  }

  const merged = await mergeFastForward(normalized, state.branch);
  if (!merged.ok) {
    return {
      ok: false,
      code: 'merge_not_fast_forward',
      message: 'Перемоткой не сливается: ветка проекта ушла вперёд. Разберите расхождение сами — вслепую приложение этого не делает',
      detail: merged.stderr.trim()
    };
  }

  const note = await journal(normalized, record.id, 'дифф принят, слито', actor);
  return { ok: true, state: await workState(normalized, record, readBody(normalized, record)), ...(note ? { note } : {}) };
}

export async function reject(root: string, record: IndexRecord, actor: string): Promise<WorkOutcome> {
  const normalized = normalizeRoot(root);
  const note = await journal(normalized, record.id, 'дифф отклонён', actor);
  return { ok: true, state: await workState(normalized, record, readBody(normalized, record)), ...(note ? { note } : {}) };
}

/** Ветки задач, которые остались после закрытия: их видно в нарушениях. */
export async function orphanBranches(root: string, index: ProjectIndex): Promise<string[]> {
  const branches = await listWorkBranches(root);
  const closed = new Set(
    index.records
      .filter((record) => record.status === 'done' || record.status === 'dropped')
      .map((record) => branchName(record.id, record.title))
  );
  return branches.filter((branch) => closed.has(branch));
}

function taskContext(
  root: string,
  index: ProjectIndex,
  record: IndexRecord,
  body: string,
  rework: string,
  round: number
): TaskContext {
  const linked = (id: string) => {
    const found = index.records.find((item) => item.id === id);
    return {
      id,
      title: found?.title ?? id,
      // Текст записи целиком: подтверждённое кладётся как есть, без пересказа.
      body: found ? withoutJournal(readRecord(root, found.path)) : ''
    };
  };

  const mapId = (record.links.affects ?? [])[0];

  return {
    id: record.id,
    title: record.title,
    body: withoutJournal(body),
    requirements: (record.links.implements ?? []).map(linked),
    documents: [...(record.links.documents ?? []), ...(record.links.refines ?? [])].map(linked),
    map: mapId ? mapChange(root, index, mapId) : '',
    // Сжатая карта: где что лежит — вместо обхода всех файлов проекта.
    modules: buildProjectMap(root).codemap.modules,
    rework,
    round
  };
}

/** Что именно меняет карта: структуры, а не пересказ записи. */
function mapChange(root: string, index: ProjectIndex, id: string): string {
  const record = index.records.find((item) => item.id === id);
  if (!record) return '';
  const parsed = parseMapRecord(readRecord(root, record.path));
  return parsed.present.length === 0 ? '' : JSON.stringify(parsed.change, null, 2);
}

function readRecord(root: string, path: string): string {
  try {
    return readFileSync(`${normalizeRoot(root)}/${path}`, 'utf8');
  } catch {
    return '';
  }
}

function withoutJournal(body: string): string {
  const at = body.search(/^##\s+Журнал\s*$/m);
  return at === -1 ? body : body.slice(0, at);
}

function readBody(root: string, record: IndexRecord): string {
  return readRecord(root, record.path);
}

async function journal(root: string, id: string, action: string, actor: string): Promise<string | undefined> {
  const context = await openRecord(root, id);
  if (!context) return undefined;
  const outcome = applyJournalNote(context.original, { action, actor, today: today() });
  const saved = saveRecord(context, outcome, root);
  return saved.ok ? outcome.journal : undefined;
}
