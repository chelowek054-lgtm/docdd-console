import type { Report, VerificationOutcome, VerificationResult } from './types';

/**
 * Отчёты складываются в «последний результат» по времени начала прогона:
 * у проверки нет статуса, есть факт последнего запуска. Файлы читает фаза 4,
 * сюда они приходят уже разобранными.
 */
export function latestVerificationResults(reports: readonly Report[]): Map<string, VerificationResult> {
  const ordered = [...reports].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const results = new Map<string, VerificationResult>();
  for (const report of ordered) {
    for (const [id, result] of Object.entries(report.verifications)) {
      results.set(id, result);
    }
  }
  return results;
}

/**
 * То же самое, но с временем прогона: интерфейсу нужно показать не только
 * результат, но и когда он получен (docs/03-server-api.md, `verificationResults`).
 */
export function latestVerificationDetails(reports: readonly Report[]): Map<string, VerificationOutcome> {
  const ordered = [...reports].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const results = new Map<string, VerificationOutcome>();
  for (const report of ordered) {
    for (const [id, state] of Object.entries(report.verifications)) {
      results.set(id, { state, at: report.started_at, runner: report.runner });
    }
  }
  return results;
}
