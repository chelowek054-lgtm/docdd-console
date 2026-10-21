// V-0062
import { describe, expect, it } from 'vitest';

import { runReportName, runReportText } from '../server/lib/manual-report';
import { validateReport } from '../server/lib/schema';

/** R-0062: прогон набора пишет отчёт с версией сборки и итогом по каждой проверке и общим. */
const NOW = new Date('2026-10-21T10:00:00Z');

describe('прогон набора проверок (R-0062)', () => {
  it('отчёт: build, итог по каждой, общий total/failed', () => {
    const report = JSON.parse(runReportText(' 1.4.0+7 ', { 'V-1': 'passed', 'V-2': 'failed', 'V-3': 'skipped' }, 'qa', NOW, { by: 'Анна' }));
    expect(report).toMatchObject({ contract: 'docdd.workspace/1', build: '1.4.0+7', total: 3, failed: 1, runner: 'manual:qa', checked_by: 'Анна' });
    expect(report.verifications).toEqual({ 'V-1': 'passed', 'V-2': 'failed', 'V-3': 'skipped' });
  });

  it('отчёт проходит схему отчёта', () => {
    const report = JSON.parse(runReportText('b1', { 'V-0001': 'passed' }, 'qa', NOW));
    expect(validateReport(report)).toEqual([]);
  });

  it('имя файла несёт сборку и безопасно; разные сборки не затирают друг друга', () => {
    expect(runReportName('1.4.0 / x', NOW)).not.toMatch(/[\\/ ]/u);
    expect(runReportName('1.4.0', NOW)).not.toBe(runReportName('1.5.0', NOW));
    expect(runReportName('', NOW)).toContain('-run-build-');
  });
});
