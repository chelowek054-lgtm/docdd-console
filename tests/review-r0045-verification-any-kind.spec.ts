// V-0045 (R-0045): у каждой задачи есть проверка; приёмка любого вида с записью. Дополняет task-no-verification.spec.ts и manual-accept.spec.ts.
import { describe, expect, it } from 'vitest';

import { manualReportText, verifiedJournalAction } from '../server/lib/manual-report';
import { latestVerificationDetails } from '../server/lib/reports';
import { taskNoVerification } from '../server/lib/rules';
import type { Report } from '../server/lib/types';
import { codes, context, rec } from './helpers';

describe('R-0045: task_no_verification', () => {
  const req = rec('R-0010', 'requirement', 'approved');
  it('предупреждает с состояния ready, не раньше; у dropped и backlog молчит', () => {
    const at = (status: string) => codes(taskNoVerification(context([req, rec('T-1', 'task', status, { links: { implements: ['R-0010'] } })])));
    for (const s of ['ready', 'in_progress', 'in_review', 'done']) expect(at(s)).toEqual(['task_no_verification']);
    for (const s of ['backlog', 'dropped']) expect(at(s)).toEqual([]);
  });
  it('задача вообще без требований и проверок — тоже предупреждение', () => {
    expect(codes(taskNoVerification(context([rec('T-1', 'task', 'ready')])))).toEqual(['task_no_verification']);
  });
  it('проверка любого вида считается проверкой', () => {
    for (const kind of ['unit', 'manual', 'metric']) {
      const check = rec('V-1', 'verification', 'approved', { links: { verifies: ['R-0010'] }, extra: { kind } });
      expect(taskNoVerification(context([req, check, rec('T-1', 'task', 'ready', { links: { implements: ['R-0010'] } })]))).toEqual([]);
    }
  });
});

describe('R-0045: приёмка проверки автоматического вида', () => {
  it('отчёт и журнал называют вид; пустой вид не пишется', () => {
    const r = JSON.parse(manualReportText('V-2', 'passed', 'architect', new Date(), { kind: 'integration', by: 'И', note: 'руками' }));
    expect(r.verification_kind).toBe('integration');
    expect(JSON.parse(manualReportText('V-2', 'passed', 'a', new Date(), { kind: '  ' }))).not.toHaveProperty('verification_kind');
    expect(verifiedJournalAction(true, 'architect', { kind: 'metric', note: 'x' })).toContain('(вид metric)');
  });
  it('позднейший прогон сборки заменяет ручную приёмку, позднейшая ручная — прогон', () => {
    const manual: Report = { contract: 'docdd.workspace/1', runner: 'manual:architect', started_at: '2026-10-20T10:00:00.000Z', verification_kind: 'unit', verifications: { 'V-2': 'passed' } };
    const run: Report = { contract: 'docdd.workspace/1', runner: 'vitest', started_at: '2026-10-21T10:00:00.000Z', verifications: { 'V-2': 'failed' } };
    const got = latestVerificationDetails([run, manual]).get('V-2');
    expect(got).toMatchObject({ state: 'failed', runner: 'vitest' });
    expect(got).not.toHaveProperty('manualKind');
    expect(latestVerificationDetails([manual, { ...run, started_at: '2026-10-19T00:00:00.000Z' }]).get('V-2')?.manualKind).toBe('unit');
  });
});
