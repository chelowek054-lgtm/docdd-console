import type { IndexRecord, VerificationOutcome } from '~~/server/lib/types';

/**
 * Проверки задачи так же, как их считает ворота закрытия (rules.ts, taskVerificationIds): свои `verified_by`,
 * `verified_by` её требований и проверки, сославшиеся `verifies` на требование или на саму задачу.
 */
export function taskCheckIds(task: IndexRecord, records: readonly IndexRecord[], byId: ReadonlyMap<string, IndexRecord>): string[] {
  const ids = new Set<string>(task.links.verified_by ?? []);
  const targets = new Set<string>([task.id, ...(task.links.implements ?? [])]);
  for (const id of task.links.implements ?? []) for (const check of byId.get(id)?.links.verified_by ?? []) ids.add(check);
  for (const record of records) {
    if (record.type === 'verification' && (record.links.verifies ?? []).some((target) => targets.has(target))) ids.add(record.id);
  }
  return [...ids].filter((id) => byId.get(id)?.type === 'verification');
}

/** «Принять вручную» нужна заранее (R-0135): задача на проверке, а проверок нет или не все пройдены. */
export function needsManualAccept(task: IndexRecord | undefined, records: readonly IndexRecord[], byId: ReadonlyMap<string, IndexRecord>, results: Record<string, VerificationOutcome>): boolean {
  if (!task || task.type !== 'task' || task.status !== 'in_review') return false;
  const ids = taskCheckIds(task, records, byId);
  return ids.length === 0 || ids.some((id) => results[id]?.state !== 'passed');
}
