import { applyLegacy } from '../lib/actions';
import { approvalOf, cutoffDate } from '../lib/course';
import { newIssues } from '../lib/issues-diff';
import { checkTransition } from '../lib/rules';
import { dateField } from '../lib/timing';
import type { WorkRecord } from '../lib/types';
import type { BulkOutcome, BulkResult } from './bulk-service';
import { loadIndex } from './index-service';
import { journalNow, openRecord, writeRecord } from './record-write';

/**
 * Перевод пачки в прежний курс (A-0001, docs/03-server-api.md, `records/bulk/legacy`).
 * Записи идут по очереди и читаются заново, как у `bulk/status`; отказ одной
 * остальных не останавливает. Одна причина и одна карта смены курса — на всю пачку.
 */

export interface LegacyOptions {
  reason: string;
  /** Карта, сменившая курс: поле `legacy_by` и счётчик в истории курса. */
  legacyBy?: string | null;
  /** Порог: дата или номер карты (тогда — дата её подтверждения). */
  before?: string | null;
  actor: string;
}

/** Когда запись в последний раз подтверждали; нет подтверждения — `updated`. */
function settledAt(record: WorkRecord): string {
  return approvalOf(record.body, dateField(record.data['updated']) ?? undefined).at;
}

export function bulkLegacy(root: string, ids: readonly string[], options: LegacyOptions): BulkOutcome {
  const before = loadIndex(root, true).issues;
  const stamp = journalNow(root);
  const first = openRecord(root, ids[0] ?? '');
  const cutoff = first ? cutoffDate(options.before, first.rules.records) : (options.before && /^\d{4}-\d{2}-\d{2}$/.test(options.before) ? options.before : null);
  const results: BulkResult[] = [];

  for (const id of [...new Set(ids)]) {
    const context = openRecord(root, id);
    if (!context) {
      results.push({ id, ok: false, from: '', to: '', code: 'record_not_found', message: `Записи \`${id}\` в проекте нет` });
      continue;
    }
    const from = context.record.status;
    const at = settledAt(context.record);
    if (cutoff && at && at > cutoff) {
      results.push({ id, ok: false, from, to: from, code: 'after_cutoff', message: `${id} обновлена ${at} — позже порога ${cutoff}: это уже текущий курс` });
      continue;
    }
    const blockers = checkTransition(context.record, 'legacy', context.rules);
    if (blockers.length > 0) {
      results.push({ id, ok: false, from, to: from, code: blockers[0]?.code ?? 'transition_forbidden', message: blockers.map((item) => item.message).join(' '), blockers: blockers.map((item) => ({ code: item.code, message: item.message })) });
      continue;
    }
    const outcome = applyLegacy(context.original, { reason: options.reason, legacyBy: options.legacyBy ?? null, actor: options.actor, today: stamp });
    const written = writeRecord(context, outcome, root);
    results.push(written.ok
      ? { id, ok: true, from, to: 'legacy', steps: ['legacy'] }
      : { id, ok: false, from, to: from, code: 'write_refused', message: `Запись отменена: ${written.problems.join(' ')}` });
  }

  const after = loadIndex(root, true).issues;
  const moved = results.filter((result) => result.ok).length;
  return { moved, skipped: results.length - moved, newIssues: newIssues(before, after), results };
}
