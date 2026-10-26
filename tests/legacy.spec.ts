// Прежний курс — статус legacy (A-0001, R-0103, V-0110).
import { describe, expect, it } from 'vitest';

import { applyLegacy } from '../server/lib/actions';
import { courseHistory, cutoffDate } from '../server/lib/course';
import { checkTransition, requirementUnverified, verificationNeverRun } from '../server/lib/rules';
import { requirementChoices } from '../server/lib/task-order';
import { bulkPath } from '../server/lib/transitions';
import { context, rec } from './helpers';

const codesOf = (items: readonly { code: string }[]) => items.map((item) => item.code);

describe('переход в legacy', () => {
  it('из любого статуса, черновик тоже (R-0104), — можно; обратно — только в черновик', () => {
    const ctx = context([]);
    expect(checkTransition(rec('R-0001', 'requirement', 'approved'), 'legacy', ctx)).toEqual([]);
    expect(checkTransition(rec('V-0001', 'verification', 'dropped'), 'legacy', ctx)).toEqual([]);
    expect(checkTransition(rec('A-0001', 'decision', 'rejected'), 'legacy', ctx)).toEqual([]);
    expect(checkTransition(rec('R-0002', 'requirement', 'draft'), 'legacy', ctx)).toEqual([]);
    expect(checkTransition(rec('R-0003', 'requirement', 'legacy'), 'draft', ctx)).toEqual([]);
    expect(codesOf(checkTransition(rec('R-0003', 'requirement', 'legacy'), 'approved', ctx))).toEqual(['transition_forbidden']);
  });

  it('у задачи — из любого статуса, обратно в backlog; у карты legacy нет', () => {
    const ctx = context([]);
    expect(checkTransition(rec('T-0001', 'task', 'backlog'), 'legacy', ctx)).toEqual([]);
    expect(checkTransition(rec('T-0002', 'task', 'done'), 'legacy', ctx)).toEqual([]);
    expect(checkTransition(rec('T-0002', 'task', 'legacy'), 'backlog', ctx)).toEqual([]);
    expect(codesOf(checkTransition(rec('M-0001', 'map', 'approved'), 'legacy', ctx))).toEqual(['transition_forbidden']);
    expect(codesOf(checkTransition(rec('C-0001', 'contract', 'approved'), 'legacy', ctx))).toEqual(['transition_forbidden']);
  });

  it('«Назад» пачкой возвращает legacy в черновик', () => {
    expect(bulkPath({ type: 'requirement', status: 'legacy' }, 'back')).toEqual(['draft']);
    expect(bulkPath({ type: 'task', status: 'legacy' }, 'back')).toEqual(['backlog']);
  });
});

describe('запись в legacy', () => {
  const original = `---\nid: R-0001\ntype: requirement\ntitle: Требование\nstatus: approved\ncreated: 2026-08-01\nupdated: 2026-08-01\nmine: своё\n---\n\n# Требование\n\nТекст человека.\n\n## Журнал\n\n- 2026-08-01 · подтверждён · architect\n`;

  it('статус, updated, legacy_by и строка журнала; тело не меняется', () => {
    const outcome = applyLegacy(original, { reason: 'курс сменился на офлайн-клиент', legacyBy: 'M-0042', actor: 'architect', today: '2026-10-25 14:03' });
    expect(outcome.problems).toEqual([]);
    expect(outcome.text).toContain('status: legacy');
    expect(outcome.text).toContain('updated: 2026-10-25');
    expect(outcome.text).toContain('legacy_by: M-0042');
    expect(outcome.text).toContain('mine: своё');
    expect(outcome.text).toContain('Текст человека.');
    expect(outcome.text).toContain('- 2026-10-25 14:03 · в legacy: курс сменился на офлайн-клиент · architect');
  });

  it('порог «не позже» — дата или дата подтверждения карты', () => {
    const map = rec('M-0042', 'map', 'approved', { body: '# Карта\n\n## Журнал\n\n- 2026-10-01 · подтверждён · architect\n' });
    expect(cutoffDate('2026-09-01', [map])).toBe('2026-09-01');
    expect(cutoffDate('M-0042', [map])).toBe('2026-10-01');
    expect(cutoffDate(null, [map])).toBeNull();
  });
});

describe('legacy не участвует в текущей картине', () => {
  it('нет предупреждений о проверках и прогонах', () => {
    const requirement = rec('R-0001', 'requirement', 'legacy');
    const check = rec('V-0001', 'verification', 'legacy', { extra: { kind: 'manual' } });
    const ctx = context([requirement, check]);
    expect(requirementUnverified(ctx)).toEqual([]);
    expect(verificationNeverRun(ctx)).toEqual([]);
  });

  it('не предлагается в implements новых задач', () => {
    const choices = requirementChoices([
      { id: 'R-0001', type: 'requirement', title: 'Старое', status: 'legacy' },
      { id: 'R-0002', type: 'requirement', title: 'Новое', status: 'approved' }
    ], '');
    expect(choices.map((choice) => choice.id)).toEqual(['R-0002']);
  });

  it('история курса считает отправленные в legacy', () => {
    const history = courseHistory([{ id: 'M-0042', title: 'Новый курс', approval: { at: '2026-10-01', by: 'architect' }, change: { functional: {} }, legacy: 12 }]);
    expect(history).toEqual([expect.objectContaining({ map: 'M-0042', legacy: 12 })]);
  });
});
