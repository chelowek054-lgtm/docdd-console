import { applyStatusChange } from '../lib/actions';
import { newIssues } from '../lib/issues-diff';
import { checkTransition } from '../lib/rules';
import type { IssueDto } from '../lib/types';
import { bulkPath, type BulkDirection } from '../lib/transitions';
import { loadIndex } from './index-service';
import { markDescribed } from './inventory-service';
import { openRecord, today, writeRecord } from './record-write';

/**
 * Массовая смена статуса (docs/03-server-api.md, `records/bulk/status`).
 * Записи идут по очереди, и каждая читается заново: перед следующей файлы
 * уже такие, какими их оставила предыдущая. Отказ одной остальных не
 * останавливает.
 */

export const BULK_LIMIT = 500;

export interface BulkResult {
  id: string;
  ok: boolean;
  from: string;
  /** Статус, в котором запись оказалась: у отказа равен `from`, если не сдвинулась. */
  to: string;
  steps?: string[];
  code?: string;
  message?: string;
  /** `link_map` — задача `feature` без карты: отчёт предложит завести общую (docs/04-ui.md). */
  hint?: 'link_map';
  blockers?: { code: string; message: string }[];
}

export interface BulkOutcome {
  moved: number;
  skipped: number;
  /** Нарушения, появившиеся от действия: «Назад» на опоре задач ломает задачи. */
  newIssues: IssueDto[];
  results: BulkResult[];
}

export function bulkStatus(root: string, ids: readonly string[], direction: BulkDirection, actor: string): BulkOutcome {
  const results: BulkResult[] = [];
  const stamp = today();
  // Список нарушений до действия: кэш мог устареть от правок снаружи.
  const before = loadIndex(root, true).issues;

  for (const id of [...new Set(ids)]) {
    results.push(moveRecord(root, id, direction, actor, stamp));
  }

  // Индекс пересобираем один раз: после каждой записи он никому не нужен.
  const after = loadIndex(root, true).issues;

  const moved = results.filter((result) => result.ok).length;
  return { moved, skipped: results.length - moved, newIssues: newIssues(before, after), results };
}

function moveRecord(root: string, id: string, direction: BulkDirection, actor: string, stamp: string): BulkResult {
  const first = openRecord(root, id);
  if (!first) {
    return { id, ok: false, from: '', to: '', code: 'record_not_found', message: `Записи \`${id}\` в проекте нет` };
  }

  const from = first.record.status;
  const path = bulkPath(first.record, direction);
  if (path.length === 0) {
    return {
      id,
      ok: false,
      from,
      to: from,
      code: 'transition_forbidden',
      message: noStepMessage(id, from, direction)
    };
  }

  const steps: string[] = [];
  for (const status of path) {
    const context = openRecord(root, id);
    if (!context) break;

    const blockers = checkTransition(context.record, status, context.rules);
    if (blockers.length > 0) {
      return {
        id,
        ok: false,
        from,
        to: context.record.status,
        ...(steps.length ? { steps } : {}),
        code: blockers[0]?.code ?? 'transition_forbidden',
        message: blockers.map((item) => item.message).join(' '),
        ...(needsIntentMap(blockers, context.record.links.affects) ? { hint: 'link_map' as const } : {}),
        blockers: blockers.map((item) => ({ code: item.code, message: item.message }))
      };
    }

    const outcome = applyStatusChange(context.original, { status, actor, today: stamp });
    const written = writeRecord(context, outcome, root);
    if (!written.ok) {
      return {
        id,
        ok: false,
        from,
        to: context.record.status,
        ...(steps.length ? { steps } : {}),
        code: 'write_refused',
        message: `Запись отменена: ${written.problems.join(' ')}`
      };
    }

    // Карту подтвердили — описанное ею закрыто (docs/07-maps.md).
    if (context.record.type === 'map' && status === 'approved') {
      markDescribed(root, outcome.text);
    }
    steps.push(status);
  }

  return { id, ok: true, from, to: steps[steps.length - 1] ?? from, steps };
}

/** Нет карты вовсе — не «карта есть, но черновик»: во втором случае привязывать нечего. */
function needsIntentMap(blockers: readonly { code: string }[], affects: readonly string[] | undefined): boolean {
  return blockers.some((item) => item.code === 'task_maps_unapproved') && (affects ?? []).length === 0;
}

function noStepMessage(id: string, status: string, direction: BulkDirection): string {
  const way = direction === 'back' ? 'назад' : direction === 'approve' ? 'к подтверждению' : 'вперёд';
  return `У записи ${id} в статусе \`${status}\` шага ${way} нет: изменить её можно кнопками на экране записи.`;
}
