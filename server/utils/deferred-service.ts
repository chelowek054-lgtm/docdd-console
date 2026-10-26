import { applyStatusChange } from '../lib/actions';
import { deferAction, deferTarget, type DeferDirection } from '../lib/deferred';
import { newIssues } from '../lib/issues-diff';
import { checkTransition } from '../lib/rules';
import type { BulkOutcome, BulkResult } from './bulk-service';
import { loadIndex } from './index-service';
import { journalNow, openRecord, writeRecord } from './record-write';

/**
 * Бэклог пачкой (R-0105, docs/03-server-api.md, `records/bulk/deferred`): одна причина
 * на пачку, каждая запись — своим переходом по схеме статусов. Записи идут по очереди
 * и читаются заново, отказ одной остальных не останавливает.
 */
export function bulkDeferred(root: string, ids: readonly string[], direction: DeferDirection, reason: string, actor: string): BulkOutcome {
  const before = loadIndex(root, true).issues;
  const stamp = journalNow(root);
  const results: BulkResult[] = [];

  for (const id of [...new Set(ids)]) {
    const context = openRecord(root, id);
    if (!context) {
      results.push({ id, ok: false, from: '', to: '', code: 'record_not_found', message: `Записи \`${id}\` в проекте нет` });
      continue;
    }
    const from = context.record.status;
    const to = deferTarget(context.record.type, direction);
    if (!to) {
      results.push({ id, ok: false, from, to: from, code: 'transition_forbidden', message: `У записи ${id} типа \`${context.record.type}\` бэклога нет: он есть у требований и задач` });
      continue;
    }
    const blockers = checkTransition(context.record, to, context.rules);
    if (blockers.length > 0) {
      results.push({ id, ok: false, from, to: from, code: blockers[0]?.code ?? 'transition_forbidden', message: blockers.map((item) => item.message).join(' '), blockers: blockers.map((item) => ({ code: item.code, message: item.message })) });
      continue;
    }
    const outcome = applyStatusChange(context.original, { status: to, actor, today: stamp, action: deferAction(context.record.type, direction, reason) });
    const written = writeRecord(context, outcome, root);
    results.push(written.ok
      ? { id, ok: true, from, to, steps: [to] }
      : { id, ok: false, from, to: from, code: 'write_refused', message: `Запись отменена: ${written.problems.join(' ')}` });
  }

  const after = loadIndex(root, true).issues;
  const moved = results.filter((result) => result.ok).length;
  return { moved, skipped: results.length - moved, newIssues: newIssues(before, after), results };
}
