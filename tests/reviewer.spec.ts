import { describe, expect, it } from 'vitest';

import { applyFieldPatch } from '../server/lib/actions';
import { REVIEW_TASKS_MARKER, reviewBatchPrompt, type ReviewBatchTask } from '../server/lib/prompt';
import { reviewerOf, roleName, taskChecks } from '../server/lib/reviewer';
import type { IndexRecord } from '../server/lib/types';

/**
 * R-0046 (ADR-0030): у каждой задачи — ревьюер. Явное поле побеждает, без него — правило по
 * видам проверок и типу изменения; свою работу роль не принимает.
 */

function record(id: string, type: string, extra: Record<string, unknown> = {}, links: IndexRecord['links'] = {}, owner: string | null = null): IndexRecord {
  return {
    id, type, title: id, status: 'in_review', owner, created: null, updated: null, phase: null, tags: [],
    path: `${id}.md`, section: null, links, backlinks: {}, extra
  };
}

const ROLES = ['architect', 'developer', 'pm', 'analyst', 'domain', 'viewer'].map((id) => ({ id, name: id.toUpperCase() }));
const requirement = record('R-0001', 'requirement');
const check = (id: string, kind: string) => record(id, 'verification', { kind }, { verifies: ['R-0001'] });
const task = (extra: Record<string, unknown> = {}, owner: string | null = 'developer') =>
  record('T-0001', 'task', extra, { implements: ['R-0001'] }, owner);

describe('reviewerOf', () => {
  it('явное поле reviewer побеждает правило', () => {
    const pick = reviewerOf(task({ reviewer: 'pm', change: 'feature' }), [requirement, check('V-1', 'manual')], ROLES);
    expect(pick).toEqual({ role: 'pm', why: 'назначен явно', explicit: true });
  });

  it('ручная проверка требования → аналитик, даже у feature', () => {
    const pick = reviewerOf(task({ change: 'feature' }), [requirement, check('V-1', 'unit'), check('V-2', 'manual')], ROLES);
    expect(pick?.role).toBe('analyst');
    expect(pick?.explicit).toBe(false);
  });

  it('проверка review → архитектор', () => {
    expect(reviewerOf(task({ change: 'fix' }), [requirement, check('V-1', 'review')], ROLES)?.role).toBe('architect');
  });

  it('без ручных проверок решает тип изменения', () => {
    const records = [requirement, check('V-1', 'unit')];
    expect(reviewerOf(task({ change: 'feature' }), records, ROLES)?.role).toBe('architect');
    expect(reviewerOf(task({ change: 'fix' }, 'architect'), records, ROLES)?.role).toBe('developer');
  });

  it('свою работу не принимают: fix у разработчика уходит дальше по запасному порядку', () => {
    expect(reviewerOf(task({ change: 'fix' }, 'developer'), [requirement], ROLES)?.role).toBe('architect');
  });

  it('роли нет в манифесте — берётся следующая; не подошла ни одна — ревьюера нет', () => {
    const pick = reviewerOf(task({ change: 'feature' }), [requirement], [{ id: 'developer' }, { id: 'pm' }]);
    expect(pick?.role).toBe('pm');
    expect(reviewerOf(task({ change: 'feature' }, 'pm'), [requirement], [{ id: 'pm' }])).toBeNull();
  });

  it('проверки задачи: свои verified_by и проверки её требований с обеих сторон связи', () => {
    const own = record('V-9', 'verification', { kind: 'metric' });
    const viaRequirement = record('R-0002', 'requirement', {}, { verified_by: ['V-8'] });
    const declared = record('V-8', 'verification', { kind: 'unit' });
    const t = record('T-0002', 'task', {}, { implements: ['R-0001', 'R-0002'], verified_by: ['V-9'] });
    const ids = taskChecks(t, [requirement, check('V-1', 'unit'), own, viaRequirement, declared, check('V-7', 'x')]).map((r) => r.id).sort();
    expect(ids).toEqual(['V-1', 'V-7', 'V-8', 'V-9']);
  });

  it('название роли — из манифеста, незнакомая — как есть', () => {
    expect(roleName('analyst', ROLES)).toBe('ANALYST');
    expect(roleName('qa', ROLES)).toBe('qa');
  });
});

describe('поле reviewer правится как front matter', () => {
  const original = ['---', 'id: T-0001', 'type: task', 'title: Т', 'status: in_review', 'owner: developer', '---', '', '# Т', ''].join('\n');

  it('ставится и убирается, тело не трогается', () => {
    const set = applyFieldPatch(original, { reviewer: 'analyst' }, '2026-10-20');
    expect(set.problems).toEqual([]);
    expect(set.text).toContain('reviewer: analyst');
    expect(set.text.endsWith('# Т\n')).toBe(true);
    const cleared = applyFieldPatch(set.text, { reviewer: null }, '2026-10-20');
    expect(cleared.problems).toEqual([]);
    expect(cleared.text).not.toContain('reviewer:');
  });
});

describe('запрос на проверку называет ревьюера', () => {
  const base: ReviewBatchTask = { id: 'T-0001', title: 'Т', path: 'T.md', phase: null, requirements: [], verifications: [], maps: [] };

  it('ревьюер с причиной; нет ревьюера и нет проверок — сказано прямо', () => {
    const settings = { agents: 1, perAgent: 1, minutes: 1, branch: 'rv' };
    const named = reviewBatchPrompt(REVIEW_TASKS_MARKER, settings, [{ ...base, reviewer: { role: 'analyst', name: 'Аналитик', why: 'ручная проверка' } }]);
    expect(named).toContain('Ревьюер: Аналитик (`analyst`) — ручная проверка');
    const none = reviewBatchPrompt(REVIEW_TASKS_MARKER, settings, [base]);
    expect(none).toContain('Ревьюер: не определён');
    expect(none).toContain('task_no_verification');
  });
});
