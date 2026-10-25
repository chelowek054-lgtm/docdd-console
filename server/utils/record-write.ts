import { readFileSync, writeFileSync } from 'node:fs';

import { analyze } from '../lib/analyze';
import { dropCache } from '../lib/cache';
import { resolveInside } from '../lib/paths';
import { checkTransition, type RuleContext } from '../lib/rules';
import { validateFrontMatter } from '../lib/schema';
import { parseRecord } from '../lib/parse';
import type { IndexRecord, Violation, WorkRecord } from '../lib/types';
import { invalidateWorkspace, readManifest, readWorkspace, type Workspace } from '../lib/workspace';
import { stampAt } from '../lib/timing';
import type { WriteOutcome } from '../lib/actions';
import { loadIndex } from './index-service';
import { refreshReferenceIndex } from './reference-service';

/**
 * Общая часть действий процесса: прочитать запись, спросить правила, записать
 * под сторожем. Файловая система живёт здесь, решения — в `server/lib`.
 */

export interface RecordContext {
  workspace: Workspace;
  record: WorkRecord;
  absolute: string;
  original: string;
  /** Контекст правил из того же разбора: массовому действию второй не нужен. */
  rules: RuleContext;
}

export function openRecord(root: string, recordId: string): RecordContext | null {
  const workspace = readWorkspace(root);
  const result = analyze({
    files: workspace.files,
    manifest: workspace.manifest,
    reports: workspace.reports,
    codeFiles: workspace.codeFiles
  });

  const record = result.records.find((item) => item.id === recordId);
  if (!record) return null;

  const absolute = resolveInside(root, record.source.path);
  return { workspace, record, absolute, original: readFileSync(absolute, 'utf8'), rules: result.context };
}

/** Переход спрашивается у тех же правил, что дают список нарушений на экране. */
export function transitionBlockers(root: string, recordId: string, to: string): Violation[] | null {
  const workspace = readWorkspace(root);
  const result = analyze({
    files: workspace.files,
    manifest: workspace.manifest,
    reports: workspace.reports,
    codeFiles: workspace.codeFiles
  });

  const record = result.records.find((item) => item.id === recordId);
  if (!record) return null;
  return checkTransition(record, to, result.context);
}

export type SaveResult =
  | { ok: true; record: IndexRecord }
  | { ok: false; problems: string[] };

/**
 * Запись происходит, только если сторож молчит и правка не роняет схему
 * *сильнее*, чем она уже была. Отказ записать лучше испорченного документа —
 * но запись, уже испорченная до этой правки (front matter собран руками в
 * обход схемы, минуя приложение), не должна становиться от этого неприкасаемой
 * навсегда: без этого разрешён только правки того самого поля, которого не
 * хватает, — а его как раз и трогать нельзя (isSettled), и запись зависает без
 * единого доступного действия. Новые нарушения — те, которых не было в файле
 * до правки, — по-прежнему отказ.
 */
export function saveRecord(context: RecordContext, outcome: WriteOutcome, root: string): SaveResult {
  const written = writeRecord(context, outcome, root);
  if (!written.ok) return written;

  const index = loadIndex(root, true);
  // Динамически: хранилище уведомлений тянет рантайм Nitro, которого нет в чистых тестах разбора.
  void import('./notify-events').then((events) => events.notifyViolations(root, index)).catch(() => undefined);
  const record = index.records.find((item) => item.id === context.record.id);
  return record ? { ok: true, record } : { ok: false, problems: ['Запись не найдена после сохранения.'] };
}

/**
 * Запись без пересборки индекса: массовое действие пишет десятки файлов и
 * пересобирает индекс один раз в конце, а не после каждого.
 */
export function writeRecord(
  context: RecordContext,
  outcome: WriteOutcome,
  root: string
): { ok: true } | { ok: false; problems: string[] } {
  if (outcome.problems.length > 0) {
    return { ok: false, problems: outcome.problems };
  }

  const parsed = parseRecord(outcome.text, context.record.source);
  if (!parsed.ok) {
    return { ok: false, problems: [parsed.violation.message] };
  }

  const originalParsed = parseRecord(context.original, context.record.source);
  const before = new Set(
    originalParsed.ok ? validateFrontMatter(originalParsed.record.data).map((issue) => issue.message) : []
  );
  const issues = validateFrontMatter(parsed.record.data).filter((issue) => !before.has(issue.message));
  if (issues.length > 0) {
    return { ok: false, problems: issues.map((issue) => issue.message) };
  }

  writeFileSync(context.absolute, outcome.text, 'utf8');
  // Кэш производный, но устаревший кэш показал бы прежний статус: сбрасываем.
  dropCache(root);
  invalidateWorkspace(root);
  // Справка или карта изменились — индекс справочника пересобирается сам (docs/13-reference.md).
  if (context.record.type === 'reference' || context.record.type === 'map') refreshReferenceIndex(root);
  return { ok: true };
}

/** Дата действия — сегодняшняя по календарю пользователя, без времени. */
/**
 * Метка строки журнала: дата и время по поясу проекта (ADR-0039). В `updated`
 * действия берут из неё только дату. Манифест не прочитался — время сервера.
 */
export function journalNow(root: string, now = new Date()): string {
  let timezone: string | undefined;
  try { timezone = readManifest(root).project?.timezone; } catch { timezone = undefined; }
  return stampAt(now, timezone);
}

export function today(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}


/**
 * Один снимок для смены статуса: запись и ответ правил из одного чтения и
 * одного разбора, а не из двух подряд.
 */
export function openRecordWithBlockers(
  root: string,
  recordId: string,
  to: string
): { context: RecordContext; blockers: Violation[] } | null {
  const workspace = readWorkspace(root);
  const result = analyze({
    files: workspace.files,
    manifest: workspace.manifest,
    reports: workspace.reports,
    codeFiles: workspace.codeFiles
  });

  const record = result.records.find((item) => item.id === recordId);
  if (!record) return null;

  const absolute = resolveInside(root, record.source.path);
  const context = { workspace, record, absolute, original: readFileSync(absolute, 'utf8'), rules: result.context };
  return { context, blockers: checkTransition(record, to, result.context) };
}

/**
 * Пакетные маршруты: клиент присылает `versions` {номер: версия}; расхождение
 * хоть у одной записи — отказ всей пачке, чтобы не записать поверх чужой правки.
 */
export function staleVersions(root: string, versions: unknown): string[] {
  if (versions === null || typeof versions !== 'object') return [];
  const known = new Map(loadIndex(root).records.map((record) => [record.id, record.version]));
  return Object.entries(versions as Record<string, unknown>)
    .filter(([id, version]) => typeof version === 'string' && known.has(id) && known.get(id) !== version)
    .map(([id]) => id);
}
