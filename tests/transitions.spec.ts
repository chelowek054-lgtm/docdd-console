import { describe, expect, it } from 'vitest';

import { availableActions } from '../server/lib/transitions';
import { context, rec } from './helpers';

/**
 * Список действий считает сервер: экран не имеет права знать процесс, иначе
 * правило начнёт жить в двух местах и разойдётся.
 */

describe('availableActions', () => {
  it('из backlog предлагает только то, что есть в схеме статусов', () => {
    const task = rec('T-0007', 'task', 'backlog', { links: { implements: ['R-0004'] } });
    const ctx = context([rec('R-0004', 'requirement', 'approved'), task]);
    expect(availableActions(task, ctx).map((action) => action.status)).toEqual(['ready', 'dropped']);
  });

  it('называет причину, по которой действие недоступно', () => {
    const task = rec('T-0007', 'task', 'backlog');
    const ready = availableActions(task, context([task])).find((action) => action.status === 'ready');
    expect(ready?.allowed).toBe(false);
    expect(ready?.blockers.map((blocker) => blocker.code)).toEqual(['task_no_requirement']);
  });

  it('разрешает переход, когда условия выполнены', () => {
    const doc = rec('D-0004', 'design', 'approved');
    const requirement = rec('R-0004', 'requirement', 'approved');
    const task = rec('T-0007', 'task', 'backlog', {
      links: { implements: ['R-0004'], documents: ['D-0004'] }
    });
    const ready = availableActions(task, context([doc, requirement, task]))
      .find((action) => action.status === 'ready');
    expect(ready?.allowed).toBe(true);
    expect(ready?.blockers).toEqual([]);
  });

  it('из закрытой задачи не предлагает ничего', () => {
    const task = rec('T-0007', 'task', 'done', { links: { implements: ['R-0004'] } });
    expect(availableActions(task, context([task]))).toEqual([]);
  });

  it('у фазы действий нет: её статус считается по задачам', () => {
    const phase = rec('P-0001', 'phase', 'planned', { links: { covers: ['T-0007'] } });
    expect(availableActions(phase, context([phase]))).toEqual([]);
  });

  it('у решения вместо отмены — отклонение', () => {
    const decision = rec('A-0001', 'decision', 'review');
    const statuses = availableActions(decision, context([decision])).map((action) => action.status);
    expect(statuses).toContain('rejected');
    expect(statuses).not.toContain('dropped');
  });

  it('подписи — глаголы для человека, а не имена статусов', () => {
    const task = rec('T-0007', 'task', 'ready', { links: { implements: ['R-0004'] } });
    const labels = availableActions(task, context([task])).map((action) => action.label);
    expect(labels).toContain('Запустить в разработку');
    expect(labels.join(' ')).not.toContain('in_progress');
  });
});
