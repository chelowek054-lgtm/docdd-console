// Бэклог — пул на будущее (R-0105, V-0112).
import { describe, expect, it } from 'vitest';

import { applyStatusChange, statusOfJournalAction } from '../server/lib/actions';
import { deferAction, deferTarget } from '../server/lib/deferred';
import { checkTransition, requirementUnimplemented, requirementUnverified, taskOverdue, taskRequirementDeferred } from '../server/lib/rules';
import { requirementChoices } from '../server/lib/task-order';
import { context, rec } from './helpers';

const codesOf = (items: readonly { code: string }[]) => items.map((item) => item.code);

describe('переходы deferred', () => {
  it('требование: из approved — в бэклог и обратно без нового подтверждения; черновик — отказ', () => {
    const ctx = context([]);
    expect(checkTransition(rec('R-0001', 'requirement', 'approved'), 'deferred', ctx)).toEqual([]);
    expect(checkTransition(rec('R-0001', 'requirement', 'deferred'), 'approved', ctx)).toEqual([]);
    expect(checkTransition(rec('R-0001', 'requirement', 'deferred'), 'legacy', ctx)).toEqual([]);
    expect(codesOf(checkTransition(rec('R-0002', 'requirement', 'draft'), 'deferred', ctx))).toEqual(['transition_forbidden']);
    expect(codesOf(checkTransition(rec('D-0001', 'design', 'approved'), 'deferred', ctx))).toEqual(['transition_forbidden']);
  });

  it('задача: из backlog и ready — в бэклог, из in_progress — отказ, обратно — в backlog', () => {
    const ctx = context([]);
    expect(checkTransition(rec('T-0001', 'task', 'backlog'), 'deferred', ctx)).toEqual([]);
    expect(checkTransition(rec('T-0001', 'task', 'ready'), 'deferred', ctx)).toEqual([]);
    expect(codesOf(checkTransition(rec('T-0001', 'task', 'in_progress'), 'deferred', ctx))).toEqual(['transition_forbidden']);
    expect(checkTransition(rec('T-0001', 'task', 'deferred'), 'backlog', ctx)).toEqual([]);
    expect(codesOf(checkTransition(rec('T-0001', 'task', 'deferred'), 'ready', ctx))).toEqual(['transition_forbidden']);
  });

  it('куда и с какой строкой журнала; возврат читается как статус, но не как подтверждение карты', () => {
    expect([deferTarget('requirement', 'defer'), deferTarget('requirement', 'return'), deferTarget('task', 'return'), deferTarget('map', 'defer')]).toEqual(['deferred', 'approved', 'backlog', null]);
    expect(deferAction('task', 'defer', 'после релиза')).toBe('в бэклог: после релиза');
    expect(deferAction('requirement', 'return', 'пора')).toBe('подтверждён: из бэклога — пора');
    expect(statusOfJournalAction('подтверждён: из бэклога — пора')).toBe('approved');
    expect(statusOfJournalAction('в очередь: из бэклога')).toBe('backlog');
    expect(statusOfJournalAction('в бэклог: после релиза')).toBe('deferred');
    const original = '---\nid: T-0001\ntype: task\ntitle: З\nstatus: ready\ncreated: 2026-10-20\nupdated: 2026-10-20\nlinks: {}\n---\n\n# З\n\n## Журнал\n\n- 2026-10-20 · заведена · приложение\n';
    const outcome = applyStatusChange(original, { status: 'deferred', actor: 'pm', today: '2026-10-26 10:00', action: deferAction('task', 'defer', 'после релиза') });
    expect(outcome.problems).toEqual([]);
    expect(outcome.text).toContain('- 2026-10-26 10:00 · в бэклог: после релиза · pm');
  });
});

describe('отложенное вне текущей картины', () => {
  it('нет requirement_* и сроков, не предлагается в implements', () => {
    const requirement = rec('R-0001', 'requirement', 'deferred');
    const task = rec('T-0001', 'task', 'deferred', { links: { implements: ['R-0001'] }, extra: { due: '2026-08-01' } });
    const ctx = context([requirement, task], { now: '2026-08-30' });
    expect([...requirementUnverified(ctx), ...requirementUnimplemented(ctx), ...taskOverdue(ctx)]).toEqual([]);
    expect(requirementChoices([{ id: 'R-0001', type: 'requirement', title: 'Потом', status: 'deferred' }], '')).toEqual([]);
  });

  it('задача не уходит в ready, пока её требование отложено', () => {
    const requirement = rec('R-0001', 'requirement', 'deferred');
    const task = rec('T-0001', 'task', 'backlog', { links: { implements: ['R-0001'] } });
    expect(codesOf(checkTransition(task, 'ready', context([requirement, task])))).toContain('task_requirement_deferred');
    const working = rec('T-0002', 'task', 'in_progress', { links: { implements: ['R-0001'] } });
    expect(codesOf(taskRequirementDeferred(context([requirement, working])))).toEqual(['task_requirement_deferred']);
  });
});
