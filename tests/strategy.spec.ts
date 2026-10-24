// Стратегия и здоровье узла (R-0084, R-0085; docs/07-maps.md).
import { describe, expect, it } from 'vitest';

import { nodeHealth, strategyContours, worst, type StrategyInput, type StrategyRecord } from '../server/lib/strategy';

const rec = (id: string, type: string, status: string, o: Partial<StrategyRecord> = {}): StrategyRecord => ({ id, type, status, links: {}, ...o });

function input(over: Partial<StrategyInput> = {}): StrategyInput {
  return {
    capabilities: [
      { id: 'core', title: 'Ядро', owner: 'pm', declaredBy: 'M-1' },
      { id: 'core.a', parent: 'core', status: 'implemented', declaredBy: 'M-2' },
      { id: 'core.b', parent: 'core', status: 'partial', declaredBy: 'M-2' },
      { id: 'ui', title: 'Интерфейс', declaredBy: 'M-1' },
      { id: 'ui.a', parent: 'ui', status: 'implemented', declaredBy: 'M-3' }
    ],
    records: [
      rec('R-1', 'requirement', 'approved', { links: { verified_by: ['V-1'] } }),
      rec('V-1', 'verification', 'approved', { links: { verifies: ['R-1'] }, extra: { kind: 'unit' } }),
      rec('T-1', 'task', 'in_progress', { links: { affects: ['M-2'], implements: ['R-1'] } }),
      rec('P-1', 'phase', 'active', { links: { covers: ['T-1'] } })
    ],
    results: { 'V-1': { state: 'passed' } },
    issues: [],
    overdue: new Map(),
    ...over
  };
}

describe('стратегия — вид верхнего уровня функциональной карты', () => {
  it('контуры — возможности первого уровня, прогресс по листьям, владелец с наследованием', () => {
    const contours = strategyContours(input());
    expect(contours.map((c) => c.id)).toEqual(['core', 'ui']);
    const core = contours[0]!;
    expect(core.progress).toMatchObject({ implemented: 1, partial: 1, total: 2 });
    expect(core.percent).toBe(50);
    expect(core.owner).toBe('pm');
    expect(contours[1]!.owner).toBeNull();
  });
  it('всё в порядке — «в норме», без причин', () => {
    expect(nodeHealth('core', input())).toEqual({ level: 'ok', reasons: [] });
  });
});

describe('здоровье узла: четыре сигнала', () => {
  it('прогресс: обещано сейчас и не реализовано — внимание', () => {
    const base = input();
    const caps = base.capabilities.map((c) => (c.id === 'core.b' ? { ...c, status: 'not_implemented' as const, horizon: 'now' as const } : c));
    expect(nodeHealth('core', { ...base, capabilities: caps })).toMatchObject({ level: 'attention', reasons: [{ signal: 'progress' }] });
  });
  it('сроки: задача узла в просроченной фазе — проблема', () => {
    expect(nodeHealth('core', input({ overdue: new Map([['P-1', 4]]) }))).toMatchObject({ level: 'problem', reasons: [{ signal: 'deadlines', recordId: 'P-1' }] });
  });
  it('качество: провал — проблема, блокировка и ручная без приёмки — внимание', () => {
    expect(nodeHealth('core', input({ results: { 'V-1': { state: 'failed' } } })).level).toBe('problem');
    expect(nodeHealth('core', input({ results: { 'V-1': { state: 'blocked' } } })).level).toBe('attention');
    const manual = input({ results: {} });
    manual.records = manual.records.map((r) => (r.id === 'V-1' ? { ...r, extra: { kind: 'manual' } } : r));
    expect(nodeHealth('core', manual)).toMatchObject({ level: 'attention', reasons: [{ signal: 'quality', recordId: 'V-1' }] });
  });
  it('качество: требование узла без проверок — внимание', () => {
    const base = input();
    base.records = base.records.filter((r) => r.id !== 'V-1').map((r) => (r.id === 'R-1' ? { ...r, links: {} } : r));
    expect(nodeHealth('core', base).reasons.map((r) => r.text)).toEqual(['у требования R-1 нет проверок']);
  });
  it('нарушения: ошибка по записи узла — проблема, предупреждение — внимание; чужие не считаются', () => {
    expect(nodeHealth('core', input({ issues: [{ severity: 'error', recordId: 'T-1', message: 'x' }] })).level).toBe('problem');
    expect(nodeHealth('core', input({ issues: [{ severity: 'warning', recordId: 'R-1', message: 'x' }] })).level).toBe('attention');
    expect(nodeHealth('core', input({ issues: [{ severity: 'error', recordId: 'T-999', message: 'x' }] })).level).toBe('ok');
  });
  it('свёртка снизу вверх: беда в потомке видна у контура, а у соседнего контура — нет', () => {
    const bad = input({ results: { 'V-1': { state: 'failed' } } });
    const contours = strategyContours(bad);
    expect(contours.find((c) => c.id === 'core')!.health.level).toBe('problem');
    expect(contours.find((c) => c.id === 'ui')!.health.level).toBe('ok');
  });
  it('худший из сигналов побеждает', () => {
    expect(worst('ok', 'attention')).toBe('attention');
    expect(worst('problem', 'attention')).toBe('problem');
  });
});
