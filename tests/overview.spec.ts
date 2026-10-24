// V-0074
import { describe, expect, it } from 'vitest';

import { buildOverview } from '../server/lib/overview';
import type { IndexRecord, VerificationOutcome } from '../server/lib/types';

/** Обзор реального проекта (docs/04-ui.md, «Обзор»): реализованность, фазы до прода, проверки, риски. */

function rec(id: string, type: string, status: string, links: IndexRecord['links'] = {}, extra: Record<string, unknown> = {}, updated: string | null = null): IndexRecord {
  return { id, type, title: id, status, owner: null, created: null, updated, phase: null, tags: [], path: `${id}.md`, section: null, links, backlinks: {}, extra };
}

const records: IndexRecord[] = [
  rec('R-1', 'requirement', 'approved', { verified_by: ['V-1'] }),
  rec('R-2', 'requirement', 'approved'),
  rec('R-3', 'requirement', 'approved'),
  rec('V-1', 'verification', 'approved', { verifies: ['R-1'] }, { kind: 'unit' }),
  rec('V-2', 'verification', 'approved', { verifies: ['R-2'] }, { kind: 'manual' }),
  rec('V-3', 'verification', 'approved', { verifies: ['R-2'] }, { kind: 'unit' }),
  rec('T-1', 'task', 'done', { implements: ['R-1'] }),
  rec('T-2', 'task', 'done', { implements: ['R-1'] }),
  rec('T-3', 'task', 'in_review', { implements: ['R-2'] }),
  rec('T-4', 'task', 'in_progress', { implements: ['R-2'] }),
  rec('P-1', 'phase', 'planned', { covers: ['T-1', 'T-2'] }),
  rec('P-2', 'phase', 'planned', { covers: ['T-3', 'T-4'] }, { target: '2026-10-01' }),
  rec('L-1', 'release', 'approved', { ships: ['T-1', 'T-2'] }, { version: '1.0.0', environments: ['prod'] }, '2026-10-10')
];
const results: Record<string, VerificationOutcome> = {
  'V-1': { state: 'passed', at: '2026-10-20T10:00:00Z', runner: 'vitest' },
  'V-2': { state: 'passed', at: '2026-10-21T10:00:00Z', runner: 'manual:qa', checkedBy: 'Анна', note: 'прошла' },
  'V-3': { state: 'failed', at: '2026-10-20T10:00:00Z', runner: 'vitest' }
};

describe('buildOverview', () => {
  const overview = buildOverview(records, results, [{ severity: 'warning', code: 'task_stale', recordId: 'T-4', path: 'T-4.md', message: '' }], new Date('2026-10-22T00:00:00Z'));

  it('требование реализовано: все задачи закрыты и все проверки пройдены', () => {
    expect(overview.requirements).toMatchObject({ done: 1, total: 3, inWork: 1, noTasks: 1, percent: 33 });
  });

  it('проверки: автотесты и ручные порознь, упавшие и не запускавшиеся', () => {
    expect(overview.checks.auto).toEqual({ passed: 1, failed: 1, total: 2 });
    expect(overview.checks.manual).toEqual({ passed: 1, failed: 0, total: 1 });
    expect(overview.checks).toMatchObject({ failed: 1, neverRun: 0, done: 2, total: 3 });
  });

  it('фаза в проде, когда её закрытые задачи выложены в окружение prod; просрочка вехи', () => {
    const [p1, p2] = overview.phases;
    expect(p1).toMatchObject({ stage: 'prod', percent: 100, environments: ['prod'] });
    expect(p2).toMatchObject({ stage: 'review', inReview: 1, inProgress: 1, overdueDays: 21 });
  });

  it('последний прогон автотестов и ручная приёмка с именем', () => {
    expect(overview.lastAutoRun).toEqual({ runner: 'vitest', at: '2026-10-20T10:00:00Z', passed: 1, failed: 1 });
    expect(overview.manual[0]).toMatchObject({ id: 'V-2', by: 'Анна', note: 'прошла' });
  });

  it('риски: просрочка, требование без проверки, упавшая проверка, зависшая задача', () => {
    const kinds = overview.risks.map((risk) => `${risk.kind}:${risk.id}`).sort();
    expect(kinds).toEqual(['failed_check:V-3', 'overdue:P-2', 'stale:T-4', 'unverified_requirement:R-3']);
  });

  it('релизы с окружениями и задачами', () => {
    expect(overview.releases).toEqual([{ id: 'L-1', version: '1.0.0', environments: ['prod'], tasks: 2, updated: '2026-10-10' }]);
  });
});
