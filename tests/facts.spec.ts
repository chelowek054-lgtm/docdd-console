import { describe, expect, it } from 'vitest';

import { checkNote, requirementFact, taskFact } from '../app/utils/facts';

/**
 * Решение и факт (docs/04-ui.md): «подтверждён» — решение человека, «проверено»
 * — результат прогона. Слова не смешиваются.
 */

const passed = { state: 'passed' };
const failed = { state: 'failed' };

describe('requirementFact', () => {
  it('без проверок — «не проверяется», тёплым', () => {
    expect(requirementFact([], {}, 'approved')).toEqual({ label: 'не проверяется', color: 'warning' });
  });

  it('все пройдены — «проверено»; хоть одна провалена — «не прошла»', () => {
    expect(requirementFact(['V-1', 'V-2'], { 'V-1': passed, 'V-2': passed }, 'draft').label).toBe('проверено');
    expect(requirementFact(['V-1', 'V-2'], { 'V-1': passed, 'V-2': failed }, 'approved')).toEqual({ label: 'не прошла', color: 'error' });
  });

  it('объявлено, но не прогнано — «не проверено»; у подтверждённого требования это тёплое расхождение', () => {
    expect(requirementFact(['V-1'], {}, 'draft')).toEqual({ label: 'не проверено', color: 'neutral' });
    expect(requirementFact(['V-1'], { 'V-1': passed }, 'approved').label).toBe('проверено');
    expect(requirementFact(['V-1', 'V-2'], { 'V-1': passed }, 'approved')).toEqual({ label: 'не проверено', color: 'warning' });
  });

  it('слова «подтверждено» в факте нет: оно принадлежит решению', () => {
    for (const status of ['draft', 'approved']) {
      for (const results of [{}, { 'V-1': passed }, { 'V-1': failed }]) {
        expect(requirementFact(['V-1'], results, status).label).not.toMatch(/подтвержд/);
      }
    }
  });
});

describe('taskFact', () => {
  const done = (verified_by?: string[]) => ({ status: 'done', links: verified_by ? { verified_by } : {} });

  it('у незакрытой задачи факта ещё нет', () => {
    expect(taskFact({ status: 'in_review', links: {} }, {})).toBeNull();
  });

  it('закрыта без проверки, закрыта непроверенной и проверена', () => {
    expect(taskFact(done(), {})).toEqual({ label: 'закрыта без проверки', color: 'warning' });
    expect(taskFact(done(['V-1']), {})).toEqual({ label: 'закрыта, не проверена', color: 'warning' });
    expect(taskFact(done(['V-1', 'V-2']), { 'V-1': passed, 'V-2': failed })?.label).toBe('закрыта, не проверена');
    expect(taskFact(done(['V-1']), { 'V-1': passed })).toEqual({ label: 'проверена', color: 'success' });
  });
});

describe('checkNote', () => {
  it('результат есть, а проверка не подтверждена — пометка; иначе тишина', () => {
    expect(checkNote('draft', true)).toBe('сама проверка не подтверждена');
    expect(checkNote('review', true)).toBe('сама проверка не подтверждена');
    expect(checkNote('approved', true)).toBeNull();
    expect(checkNote('draft', false)).toBeNull();
  });
});
