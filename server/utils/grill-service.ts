import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, posix } from 'node:path';

import {
  addTurn,
  appendClarifications,
  applyAnswers,
  createSession,
  finishSession,
  grillPrompt,
  intentPrompt,
  INTENT_LIMIT,
  isSessionName,
  openQuestions,
  parseSession,
  parseTurn,
  pendingThemes,
  serializeSession,
  sessionFileName,
  waitingQuestions,
  type GrillAnswer,
  type GrillMode,
  type GrillQuestion,
  type GrillSession
} from '../lib/grill';
import { dropCache } from '../lib/cache';
import { normalizeRoot, OutsideRootError, resolveInside, toProjectPath } from '../lib/paths';
import { readWorkspace } from '../lib/workspace';
import { inboxNotes } from './inbox-service';
import { loadIndex } from './index-service';
import { buildProjectMap } from './map-service';

/**
 * Допрос проекта (R-0114, A-0003): сессия в файле входящего, модель только задаёт вопросы.
 * Модель передаётся снаружи: маршрут ведёт её через общий путь с учётом, тест подставляет свою.
 */
export type GrillModel = (prompt: string, access: 'none' | 'read') => Promise<{ ok: true; answer: string } | { ok: false; failure: { code: string; message: string } }>;

export interface GrillRefusal { status: number; code: string; message: string }

export interface GrillView {
  path: string;
  session: GrillSession;
  waiting: GrillQuestion[];
  open: GrillQuestion[];
  pending: string[];
  /** Ответ модели не разобран: сессия цела, запрос можно повторить. */
  problem?: string;
}

export type GrillOutcome = { ok: true; view: GrillView } | ({ ok: false; view?: GrillView } & GrillRefusal);

export interface GrillInput {
  action: 'start' | 'answer' | 'finish';
  mode?: GrillMode;
  path?: string;
  answers?: readonly GrillAnswer[];
}

const NO_INBOX: GrillRefusal = { status: 422, code: 'inbox_not_configured', message: 'Сессии некуда лечь: в манифесте не назван `sources.inbox`' };

const viewOf = (path: string, session: GrillSession, problem?: string): GrillView => ({
  path,
  session,
  waiting: waitingQuestions(session),
  open: openQuestions(session),
  pending: pendingThemes(session),
  ...(problem ? { problem } : {})
});

const inboxFolders = (root: string): string[] => readWorkspace(root).manifest.sources?.inbox ?? [];

/** Заметка принимается только прямо из входящего: браузер называет путь, но решает не он. */
export function inboxFile(root: string, path: string): ({ ok: true; absolute: string }) | ({ ok: false } & GrillRefusal) {
  const normalized = normalizeRoot(root);
  try {
    const absolute = resolveInside(normalized, path);
    const relative = toProjectPath(normalized, absolute);
    if (!inboxFolders(normalized).includes(posix.dirname(relative))) {
      return { ok: false, status: 422, code: 'note_outside_inbox', message: `\`${path}\` не лежит во входящем проекта` };
    }
    if (!existsSync(absolute)) return { ok: false, status: 404, code: 'note_not_found', message: `Заметки \`${path}\` нет` };
    return { ok: true, absolute };
  } catch (error) {
    if (error instanceof OutsideRootError) return { ok: false, status: 403, code: 'outside_root', message: error.message };
    throw error;
  }
}

/** Последняя неразобранная сессия: разобранная уехала в «принятое», и допрос можно начать заново. */
export function currentSession(root: string): GrillView | null {
  const normalized = normalizeRoot(root);
  const found = inboxNotes(normalized)
    .filter((note) => isSessionName(posix.basename(note.path)))
    .map((note) => ({ path: note.path, session: parseSession(note.text) }))
    .filter((note): note is { path: string; session: GrillSession } => note.session !== null)
    .sort((first, second) => second.path.localeCompare(first.path))[0];
  return found ? viewOf(found.path, found.session) : null;
}

function save(root: string, path: string, session: GrillSession): void {
  writeFileSync(resolveInside(root, path), serializeSession(session), 'utf8');
  dropCache(root);
}

function begin(root: string, mode: GrillMode, now: Date): ({ ok: true; path: string; session: GrillSession }) | ({ ok: false } & GrillRefusal) {
  const folder = inboxFolders(root)[0];
  if (!folder) return { ok: false, ...NO_INBOX };
  const absolute = resolveInside(root, folder);
  mkdirSync(absolute, { recursive: true });
  const base = sessionFileName(now).replace(/\.md$/, '');
  let name = `${base}.md`;
  for (let n = 2; existsSync(join(absolute, name)); n += 1) name = `${base}-${n}.md`;
  const session = createSession(mode, `Допрос проекта ${now.toISOString().slice(0, 10)}`);
  const path = toProjectPath(root, join(absolute, name));
  save(root, path, session);
  return { ok: true, path, session };
}

function load(root: string, path: string): ({ ok: true; session: GrillSession }) | ({ ok: false } & GrillRefusal) {
  const file = inboxFile(root, path);
  if (!file.ok) return file;
  const session = isSessionName(posix.basename(path)) ? parseSession(readFileSync(file.absolute, 'utf8')) : null;
  if (!session) return { ok: false, status: 422, code: 'session_invalid', message: `\`${path}\` не читается как сессия допроса` };
  return { ok: true, session };
}

/** Проверка до открытия потока: пока заголовки не ушли, отказ можно отдать настоящим кодом. */
export function grillRefusal(root: string, input: GrillInput): GrillRefusal | null {
  const normalized = normalizeRoot(root);
  if (input.action === 'start') {
    if (input.mode !== 'new' && input.mode !== 'existing') return { status: 400, code: 'mode_invalid', message: 'Режим допроса: `new` или `existing`' };
    return inboxFolders(normalized).length ? null : NO_INBOX;
  }
  if (input.action !== 'answer' && input.action !== 'finish') return { status: 400, code: 'action_invalid', message: 'Действия допроса: `start`, `answer`, `finish`' };
  if (!input.path) return { status: 400, code: 'path_required', message: 'Не названа сессия допроса' };
  const opened = load(normalized, input.path);
  return opened.ok ? null : opened;
}

/** Один ход. Ответы пишутся до запроса к модели: обрыв и сбой их не теряют. */
export async function grillStep(root: string, input: GrillInput, template: string, model: GrillModel, now = new Date()): Promise<GrillOutcome> {
  const normalized = normalizeRoot(root);
  let path: string;
  let session: GrillSession;

  if (input.action === 'start') {
    const current = currentSession(normalized);
    if (current) {
      path = current.path;
      session = current.session;
    } else {
      const started = begin(normalized, input.mode ?? 'new', now);
      if (!started.ok) return started;
      path = started.path;
      session = started.session;
    }
  } else {
    path = input.path ?? '';
    const opened = load(normalized, path);
    if (!opened.ok) return opened;
    session = opened.session;
  }

  if (input.answers?.length) {
    session = applyAnswers(session, input.answers);
    save(normalized, path, session);
  }
  if (input.action === 'finish') {
    session = finishSession(session);
    save(normalized, path, session);
    return { ok: true, view: viewOf(path, session) };
  }
  // Пока есть вопросы без ответа, новых не просим: ход стоит денег, а спросить ещё успеем.
  if (session.status === 'done' || waitingQuestions(session).length) return { ok: true, view: viewOf(path, session) };

  const known = session.mode === 'existing'
    ? loadIndex(normalized).records.map((record) => ({ id: record.id, type: record.type, title: record.title }))
    : [];
  const asked = await model(grillPrompt(template, session, known), session.mode === 'existing' ? 'read' : 'none');
  if (!asked.ok) {
    return { ok: false, status: 502, code: `llm_${asked.failure.code}`, message: asked.failure.message, view: viewOf(path, session) };
  }
  const turn = parseTurn(asked.answer);
  if (!turn.ok) return { ok: true, view: viewOf(path, session, turn.problem) };
  session = addTurn(session, turn);
  if (turn.done && !turn.questions.length) session = finishSession(session);
  save(normalized, path, session);
  return { ok: true, view: viewOf(path, session) };
}

export interface IntentQuestion { theme: string; text: string }

/**
 * Короткий допрос на намерение (R-0116): сбой модели — не повод мешать разложить, поэтому причина
 * едет рядом с пустым списком. Отмена — другое: человек передумал, и разбор не начинается.
 */
export async function intentQuestions(root: string, path: string, template: string, model: GrillModel): Promise<({ ok: true; questions: IntentQuestion[]; problem?: string }) | ({ ok: false } & GrillRefusal)> {
  const normalized = normalizeRoot(root);
  const file = inboxFile(normalized, path);
  if (!file.ok) return file;
  const vision = buildProjectMap(normalized).functional.vision ?? null;
  const asked = await model(intentPrompt(template, readFileSync(file.absolute, 'utf8'), vision), 'none');
  if (!asked.ok) {
    if (asked.failure.code === 'cancelled') return { ok: false, status: 499, code: 'llm_cancelled', message: asked.failure.message };
    return { ok: true, questions: [], problem: asked.failure.message };
  }
  const turn = parseTurn(asked.answer, INTENT_LIMIT);
  return turn.ok ? { ok: true, questions: turn.questions } : { ok: true, questions: [], problem: turn.problem };
}

export function saveClarifications(root: string, path: string, answers: readonly { text: string; answer: string }[]): ({ ok: true }) | ({ ok: false } & GrillRefusal) {
  const normalized = normalizeRoot(root);
  const file = inboxFile(normalized, path);
  if (!file.ok) return file;
  writeFileSync(file.absolute, appendClarifications(readFileSync(file.absolute, 'utf8'), answers), 'utf8');
  dropCache(normalized);
  return { ok: true };
}
