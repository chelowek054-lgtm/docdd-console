import { describe, expect, it } from 'vitest';

import { phaseProgress, phaseState } from '../app/utils/phases';
import type { IndexRecord, LinkKind } from '../server/lib/types';

/**
 * Статус фазы считается по задачам и вручную не ставится
 * (docs/02-workspace-contract.md, «Статусы»; docs/04-ui.md, «Фазы»).
 */

function record(
  id: string,
  type: string,
  status: string,
  links: Partial<Record<LinkKind, string[]>> = {},
  phase: string | null = null
): IndexRecord {
  return {
    id,
    type,
    title: `Запись ${id}`,
    status,
    owner: null,
    created: null,
    updated: null,
    phase,
    tags: [],
    path: `docs/development/${type}/${id}.md`,
    section: null,
    links,
    backlinks: {},
    extra: {}
  };
}

describe('phaseState', () => {
  it('без состава и без начатых задач — planned', () => {
    expect(phaseState([])).toBe('planned');
    expect(phaseState([{ status: 'backlog' }, { status: 'ready' }])).toBe('planned');
  });

  it('хоть одна начата, но закрыты не все — active', () => {
    expect(phaseState([{ status: 'in_progress' }, { status: 'backlog' }])).toBe('active');
    expect(phaseState([{ status: 'done' }, { status: 'ready' }])).toBe('active');
  });

  it('всё закрыто или отменено и хотя бы одна закрыта — done', () => {
    expect(phaseState([{ status: 'done' }, { status: 'dropped' }])).toBe('done');
  });

  it('всё отменено — фаза ничего не сделала и закрытой не считается', () => {
    expect(phaseState([{ status: 'dropped' }])).toBe('planned');
  });
});

describe('phaseProgress', () => {
  it('состав — covers фазы и поле phase у задачи, одним множеством', () => {
    const phase = record('P-0001', 'phase', 'planned', { covers: ['T-0001', 'T-0002'] });
    const records = [
      phase,
      record('T-0002', 'task', 'done'),
      record('T-0001', 'task', 'in_progress', {}, 'P-0001'),
      record('T-0003', 'task', 'backlog', {}, 'P-0001'),
      record('T-0004', 'task', 'ready', {}, 'P-0002'),
      record('R-0001', 'requirement', 'approved')
    ];

    const progress = phaseProgress(phase, records);
    expect(progress.tasks.map((task) => task.id)).toEqual(['T-0001', 'T-0002', 'T-0003']);
    expect(progress.state).toBe('active');
    expect(progress.open.map((task) => task.id)).toEqual(['T-0001', 'T-0003']);
  });

  it('полоса готовности не считает отменённые ни в сделанное, ни в общее', () => {
    const phase = record('P-0001', 'phase', 'planned', { covers: ['T-0001', 'T-0002', 'T-0003'] });
    const progress = phaseProgress(phase, [
      phase,
      record('T-0001', 'task', 'done'),
      record('T-0002', 'task', 'dropped'),
      record('T-0003', 'task', 'in_review')
    ]);
    expect(progress.done).toBe(1);
    expect(progress.total).toBe(2);
  });

  it('статус из файла фазы на расчёт не влияет', () => {
    const phase = record('P-0001', 'phase', 'done');
    expect(phaseProgress(phase, [phase]).state).toBe('planned');
  });
});
