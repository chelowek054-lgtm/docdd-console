import type { IndexRecord } from './types';

/**
 * Рабочее место тестировщика на «Сверке» (docs/04-ui.md, «Сверка — рабочее место
 * тестировщика»): факт каждой проверки одним словом и пробелы покрытия.
 * Чистые функции над индексом.
 */

export const FACTS = ['failed', 'awaiting', 'never', 'passed'] as const;
export type Fact = (typeof FACTS)[number];

/** Ручную проверку прогоняет только человек: без итога она ждёт его, а не сборку. */
const MANUAL_KINDS = new Set(['manual', 'review']);

export function kindOf(check: IndexRecord): string {
  const kind = check.extra['kind'];
  return typeof kind === 'string' ? kind : '';
}

export function factOf(check: IndexRecord, state: string | undefined): Fact {
  if (state === 'failed') return 'failed';
  if (state === 'passed') return 'passed';
  return MANUAL_KINDS.has(kindOf(check)) ? 'awaiting' : 'never';
}

export function factCounts(checks: readonly IndexRecord[], results: Readonly<Record<string, { state: string } | undefined>>): Record<Fact, number> {
  const counts: Record<Fact, number> = { failed: 0, awaiting: 0, never: 0, passed: 0 };
  for (const check of checks) counts[factOf(check, results[check.id]?.state)] += 1;
  return counts;
}

/** Поля контракта проверки: их показывает карточка «Как проверить», а не «Поля проекта». */
export const VERIFICATION_FIELDS: ReadonlySet<string> = new Set(['kind', 'runner', 'command']);

export interface RunEntry { at: string; runner: string; state: string; note?: string; checkedBy?: string }

/** Отчёты, где встречается проверка, новые сверху: «когда её гоняли и что вышло». */
export function runHistory(
  reports: readonly { started_at: string; runner: string; verifications: Record<string, string>; note?: string; checked_by?: string }[],
  id: string,
  limit = 10
): RunEntry[] {
  return reports
    .filter((report) => id in report.verifications)
    .map((report) => ({
      at: report.started_at,
      runner: report.runner,
      state: report.verifications[id] ?? '',
      ...(report.note ? { note: report.note } : {}),
      ...(report.checked_by ? { checkedBy: report.checked_by } : {})
    }))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}

/**
 * Подтверждённые требования без единой проверки — черновик ещё может измениться,
 * а заменённое и отменённое проверять незачем. Связь ставят с любой стороны:
 * `verified_by` у требования или `verifies` у проверки.
 */
export function uncoveredRequirements(records: readonly IndexRecord[]): IndexRecord[] {
  const verified = new Set<string>();
  for (const record of records) {
    if (record.type === 'verification') for (const id of record.links.verifies ?? []) verified.add(id);
  }
  return records
    .filter((record) => record.type === 'requirement' && record.status === 'approved')
    .filter((record) => !verified.has(record.id) && (record.links.verified_by ?? []).length === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}
