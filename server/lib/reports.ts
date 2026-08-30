import type { Report, VerificationResult } from './types';

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
