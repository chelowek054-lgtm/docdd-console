import { readFileSync, writeFileSync } from 'node:fs';

import { analyze } from '../lib/analyze';
import { dropCache } from '../lib/cache';
import { resolveInside } from '../lib/paths';
import { checkTransition } from '../lib/rules';
import { validateFrontMatter } from '../lib/schema';
import { parseRecord } from '../lib/parse';
import type { IndexRecord, Violation, WorkRecord } from '../lib/types';
import { readWorkspace, type Workspace } from '../lib/workspace';
import type { WriteOutcome } from '../lib/actions';
import { loadIndex } from './index-service';

/**
 * Общая часть действий процесса: прочитать запись, спросить правила, записать
 * под сторожем. Файловая система живёт здесь, решения — в `server/lib`.
 */

export interface RecordContext {
  workspace: Workspace;
  record: WorkRecord;
  absolute: string;
  original: string;
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
  return { workspace, record, absolute, original: readFileSync(absolute, 'utf8') };
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
 * Запись происходит, только если сторож молчит и front matter после правки
 * по-прежнему проходит схему. Отказ записать лучше испорченного документа.
 */
export function saveRecord(context: RecordContext, outcome: WriteOutcome, root: string): SaveResult {
  if (outcome.problems.length > 0) {
    return { ok: false, problems: outcome.problems };
  }

  const parsed = parseRecord(outcome.text, context.record.source);
  if (!parsed.ok) {
    return { ok: false, problems: [parsed.violation.message] };
  }

  const issues = validateFrontMatter(parsed.record.data);
  if (issues.length > 0) {
    return { ok: false, problems: issues.map((issue) => issue.message) };
  }

  writeFileSync(context.absolute, outcome.text, 'utf8');
  // Кэш производный, но устаревший кэш показал бы прежний статус: сбрасываем.
  dropCache(root);

  const index = loadIndex(root, true);
  const record = index.records.find((item) => item.id === context.record.id);
  return record ? { ok: true, record } : { ok: false, problems: ['Запись не найдена после сохранения.'] };
}

/** Дата действия — сегодняшняя по календарю пользователя, без времени. */
export function today(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}
