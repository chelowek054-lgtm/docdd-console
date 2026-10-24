// Сверка — рабочее место тестировщика (docs/04-ui.md).
import { describe, expect, it } from 'vitest';

import { NO_ASSIGNEE, assigneeOf, byAssignee, factCounts, factOf, runHistory, uncoveredRequirements } from '../server/lib/verify-desk';
import type { IndexRecord } from '../server/lib/types';

const idx = (id: string, type: string, status: string, o: Partial<IndexRecord> & { extra?: Record<string, unknown> } = {}): IndexRecord =>
  ({ id, type, status, title: `Запись ${id}`, links: {}, extra: {}, ...o }) as unknown as IndexRecord;

describe('факт проверки', () => {
  const unit = idx('V-0001', 'verification', 'approved', { extra: { kind: 'unit' } });
  const manual = idx('V-0002', 'verification', 'approved', { extra: { kind: 'manual' } });
  it('провал и прохождение — по последнему результату', () => {
    expect(factOf(unit, 'failed')).toBe('failed');
    expect(factOf(manual, 'passed')).toBe('passed');
  });
  it('без результата ручная ждёт человека, автоматическая — не запускалась; skipped — не запускалась', () => {
    expect(factOf(manual, undefined)).toBe('awaiting');
    expect(factOf(unit, undefined)).toBe('never');
    expect(factOf(unit, 'skipped')).toBe('never');
  });
  it('счётчики по фактам', () => {
    expect(factCounts([unit, manual], { 'V-0001': { state: 'failed' } })).toEqual({ failed: 1, blocked: 0, awaiting: 1, never: 0, passed: 0 });
  });
});

describe('требования без проверок', () => {
  it('подтверждённые, без verifies и без verified_by', () => {
    const records = [
      idx('R-0001', 'requirement', 'approved'),
      idx('R-0002', 'requirement', 'approved'),
      idx('R-0003', 'requirement', 'approved', { links: { verified_by: ['V-0009'] } }),
      idx('R-0004', 'requirement', 'draft'),
      idx('V-0001', 'verification', 'approved', { links: { verifies: ['R-0002'] } })
    ];
    expect(uncoveredRequirements(records).map((r) => r.id)).toEqual(['R-0001']);
  });
});

describe('история прогонов проверки', () => {
  it('только отчёты с этой проверкой, новые сверху, не больше лимита', () => {
    const reports: { started_at: string; runner: string; verifications: Record<string, string>; note?: string; checked_by?: string }[] = [
      { started_at: '2026-10-01T10:00', runner: 'npm', verifications: { 'V-0001': 'passed' } },
      { started_at: '2026-10-03T10:00', runner: 'manual:qa', verifications: { 'V-0001': 'failed' }, note: 'кнопка не жмётся', checked_by: 'ann' },
      { started_at: '2026-10-02T10:00', runner: 'npm', verifications: { 'V-0002': 'passed' } }
    ];
    expect(runHistory(reports, 'V-0001')).toEqual([
      { at: '2026-10-03T10:00', runner: 'manual:qa', state: 'failed', note: 'кнопка не жмётся', checkedBy: 'ann' },
      { at: '2026-10-01T10:00', runner: 'npm', state: 'passed' }
    ]);
    expect(runHistory(reports, 'V-0001', 1)).toHaveLength(1);
  });
});

describe('итог «заблокирована» (R-0098)', () => {
  const unit = idx('V-0001', 'verification', 'approved', { extra: { kind: 'unit' } });
  it('факт — blocked, не провал и не «не запускалась»', () => {
    expect(factOf(unit, 'blocked')).toBe('blocked');
    expect(factCounts([unit], { 'V-0001': { state: 'blocked' } }).blocked).toBe(1);
  });
  it('причина попадает в историю прогона', () => {
    const reports = [{ started_at: '2026-10-03T10:00', runner: 'manual:qa', verifications: { 'V-0001': 'blocked' }, reasons: { 'V-0001': 'ждёт T-0042' } }];
    expect(runHistory(reports, 'V-0001')[0]).toMatchObject({ state: 'blocked', reason: 'ждёт T-0042' });
  });
});

describe('исполнитель проверки (R-0097)', () => {
  const mine = idx('V-0001', 'verification', 'approved', { extra: { assignee: 'ann' } });
  const free = idx('V-0002', 'verification', 'approved');
  it('assigneeOf читает логин, пусто — никому', () => {
    expect(assigneeOf(mine)).toBe('ann');
    expect(assigneeOf(free)).toBe('');
  });
  it('фильтры «Мои» и «Без исполнителя»', () => {
    expect(byAssignee([mine, free], 'ann').map((r) => r.id)).toEqual(['V-0001']);
    expect(byAssignee([mine, free], NO_ASSIGNEE).map((r) => r.id)).toEqual(['V-0002']);
    expect(byAssignee([mine, free], '')).toHaveLength(2);
  });
});

describe('отчёт прогона с blocked', () => {
  it('причины попадают в отчёт и в последний результат', async () => {
    const { runReportText } = await import('../server/lib/manual-report');
    const { latestVerificationDetails } = await import('../server/lib/reports');
    const text = runReportText('1.0', { 'V-0001': 'blocked' }, 'qa', new Date('2026-10-22T10:00:00Z'), { reasons: { 'V-0001': 'ждёт T-0042' } });
    const report = JSON.parse(text);
    expect(report.reasons).toEqual({ 'V-0001': 'ждёт T-0042' });
    expect(latestVerificationDetails([report]).get('V-0001')).toMatchObject({ state: 'blocked', reason: 'ждёт T-0042' });
  });
});
