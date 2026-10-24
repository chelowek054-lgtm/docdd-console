// V-0046 (R-0046): ревьюер задачи по правилу и явно; ревьюер в запросе на проверку. Дополняет reviewer.spec.ts: порядок видов, пустые данные.
import { describe, expect, it } from 'vitest';

import { applyFieldPatch } from '../server/lib/actions';
import { REVIEW_TASKS_MARKER, reviewBatchPrompt } from '../server/lib/prompt';
import { reviewerOf } from '../server/lib/reviewer';
import type { IndexRecord } from '../server/lib/types';

const rec = (id: string, type: string, extra: Record<string, unknown> = {}, links: IndexRecord['links'] = {}, owner: string | null = null): IndexRecord => ({
  id, type, title: id, status: 'in_review', owner, created: null, updated: null, phase: null, tags: [], path: `${id}.md`, section: null, links, backlinks: {}, extra
});
const ROLES = ['architect', 'developer', 'pm', 'analyst'].map((id) => ({ id }));
const req = rec('R-1', 'requirement');
const chk = (id: string, kind: string) => rec(id, 'verification', { kind }, { verifies: ['R-1'] });
const task = (extra: Record<string, unknown> = {}, owner: string | null = 'developer') => rec('T-1', 'task', extra, { implements: ['R-1'] }, owner);

describe('R-0046: правило ревьюера', () => {
  it('manual → analyst, review → architect, metric → analyst', () => {
    expect(reviewerOf(task({ change: 'fix' }), [req, chk('V', 'manual')], ROLES)?.role).toBe('analyst');
    expect(reviewerOf(task({ change: 'fix' }), [req, chk('V', 'review')], ROLES)?.role).toBe('architect');
    expect(reviewerOf(task({ change: 'fix' }), [req, chk('V', 'metric')], ROLES)?.role).toBe('analyst');
  });
  it('manual важнее review (порядок правила)', () => {
    expect(reviewerOf(task(), [req, chk('V1', 'review'), chk('V2', 'manual')], ROLES)?.role).toBe('analyst');
  });
  it('feature и refactor → architect, прочее и пустое изменение → developer', () => {
    const r = (change?: string) => reviewerOf(task(change ? { change } : {}, 'pm'), [req, chk('V', 'unit')], ROLES)?.role;
    expect(r('feature')).toBe('architect');
    expect(r('refactor')).toBe('architect');
    expect(r('fix')).toBe('developer');
    expect(r()).toBe('developer');
  });
  it('аналитик — владелец задачи: manual уходит дальше (свою работу не принимают)', () => {
    expect(reviewerOf(task({ change: 'feature' }, 'analyst'), [req, chk('V', 'manual')], ROLES)?.role).toBe('architect');
  });
  it('пустая строка в reviewer — не явное назначение', () => {
    expect(reviewerOf(task({ reviewer: '  ', change: 'feature' }), [req], ROLES)?.explicit).toBe(false);
  });
  it('роли в манифесте не объявлены — ограничения по списку нет', () => {
    expect(reviewerOf(task({ change: 'feature' }), [req], [])?.role).toBe('architect');
  });
});

describe('R-0046: PATCH reviewer', () => {
  const original = ['---', 'id: T-1', 'type: task', 'title: Т', 'status: in_review', '---', '', '# Т', ''].join('\n');
  it('поле ставится и убирается null', () => {
    const set = applyFieldPatch(original, { reviewer: 'pm' }, '2026-10-20');
    expect(set.text).toContain('reviewer: pm');
    expect(applyFieldPatch(set.text, { reviewer: null }, '2026-10-20').text).not.toContain('reviewer');
  });
});

describe('R-0046: запрос на проверку', () => {
  const base = { id: 'T-1', title: 'Т', path: 'T.md', phase: null, requirements: [], verifications: [], maps: [] };
  const s = { agents: 1, perAgent: 5, minutes: 5, branch: 'rv' };
  it('«Ревьюер:» у каждой задачи, в том числе без ревьюера', () => {
    const p = reviewBatchPrompt(REVIEW_TASKS_MARKER, s, [
      { ...base, reviewer: { role: 'pm', name: 'PM', why: 'явно' } }, { ...base, id: 'T-2' }, { ...base, id: 'T-3', reviewer: null }
    ]);
    expect(p.match(/^Ревьюер:/gm)).toHaveLength(3);
  });
  it('нет задач — пустой список, без падения', () => {
    expect(reviewBatchPrompt(REVIEW_TASKS_MARKER, s, [])).not.toContain('Ревьюер:');
  });
});
