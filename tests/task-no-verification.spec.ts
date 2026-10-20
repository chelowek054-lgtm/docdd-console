import { describe, expect, it } from 'vitest';

import { checkTransition, taskNoVerification } from '../server/lib/rules';
import { codes, context, rec } from './helpers';

/** ADR-0029: у задачи, начатой и дальше, должна быть хоть одна проверка. */

describe('task_no_verification', () => {
  const requirement = rec('R-0010', 'requirement', 'approved');

  it('предупреждает о задаче без единой проверки', () => {
    const task = rec('T-0010', 'task', 'in_progress', { links: { implements: ['R-0010'] } });
    const found = taskNoVerification(context([requirement, task]));
    expect(codes(found)).toEqual(['task_no_verification']);
    expect(found[0]?.level).toBe('warning');
  });

  it('молчит у backlog: работа ещё не начата', () => {
    const task = rec('T-0010', 'task', 'backlog', { links: { implements: ['R-0010'] } });
    expect(taskNoVerification(context([requirement, task]))).toEqual([]);
  });

  it('молчит, когда проверка есть у требования (verified_by)', () => {
    const req = rec('R-0010', 'requirement', 'approved', { links: { verified_by: ['V-0010'] } });
    const check = rec('V-0010', 'verification', 'approved');
    const task = rec('T-0010', 'task', 'ready', { links: { implements: ['R-0010'] } });
    expect(taskNoVerification(context([req, check, task]))).toEqual([]);
  });

  it('молчит, когда проверка ссылается на требование через verifies', () => {
    const check = rec('V-0010', 'verification', 'approved', { links: { verifies: ['R-0010'] } });
    const task = rec('T-0010', 'task', 'in_review', { links: { implements: ['R-0010'] } });
    expect(taskNoVerification(context([requirement, check, task]))).toEqual([]);
  });

  it('молчит, когда у самой задачи есть verified_by', () => {
    const check = rec('V-0010', 'verification', 'approved');
    const task = rec('T-0010', 'task', 'ready', { links: { verified_by: ['V-0010'] } });
    expect(taskNoVerification(context([check, task]))).toEqual([]);
  });

  it('перевод в done без единой проверки блокируется, а у закрытой раньше — только предупреждение', () => {
    const task = rec('T-0010', 'task', 'in_review', { links: { implements: ['R-0010'] } });
    const policy = { require_verification_before_done: true };
    const blocked = checkTransition(task, 'done', context([requirement, task], { policy }));
    expect(codes(blocked)).toEqual(['task_done_unverified']);
    expect(blocked[0]?.message).toContain('нет ни одной проверки');

    const closed = rec('T-0011', 'task', 'done', { links: { implements: ['R-0010'] } });
    const found = context([requirement, closed]);
    expect(codes(taskNoVerification(found))).toEqual(['task_no_verification']);
  });

  it('при выключенной политике перевод в done без проверок не блокируется', () => {
    const task = rec('T-0010', 'task', 'in_review', { links: { implements: ['R-0010'] } });
    const ctx = context([requirement, task], { policy: { require_verification_before_done: false } });
    expect(checkTransition(task, 'done', ctx)).toEqual([]);
  });
});
