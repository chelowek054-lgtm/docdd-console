// Сверка — рабочее место тестировщика (docs/04-ui.md).
import { describe, expect, it } from 'vitest';

import { factCounts, factOf, uncoveredRequirements } from '../server/lib/verify-desk';
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
    expect(factCounts([unit, manual], { 'V-0001': { state: 'failed' } })).toEqual({ failed: 1, awaiting: 1, never: 0, passed: 0 });
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
