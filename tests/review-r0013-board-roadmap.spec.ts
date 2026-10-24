// V-0013 manual — подготовка (R-0013; задачи T-0032, T-0033, T-0034)
import { describe, expect, it } from 'vitest';

import { NO_ASSIGNEE, applyTarget, boardColumns, overdueDays, roadmap, unshippedTasks } from '../server/lib/manager';
import type { IndexRecord } from '../server/lib/types';
import { availableActions } from '../server/lib/transitions';
import { context, rec } from './helpers';

const idx = (id: string, type: string, status: string, o: Partial<IndexRecord> & { extra?: Record<string, unknown> } = {}): IndexRecord =>
  ({ id, type, status, title: `Запись ${id}`, links: {}, extra: {}, ...o }) as unknown as IndexRecord;

describe('R-0013 доска', () => {
  const records = [
    idx('T-0002', 'task', 'ready', { phase: 'P-1', extra: { assignee: 'ann' }, links: { affects: ['M-1'] } }),
    idx('T-0001', 'task', 'ready', { phase: 'P-1' }),
    idx('T-0003', 'task', 'done', { phase: 'P-2' }),
    idx('T-0004', 'task', 'dropped'),
    idx('P-1', 'phase', 'in_progress')
  ];
  it('колонки по статусам, отменённых нет, порядок по id', () => {
    const c = boardColumns(records);
    expect(c.ready!.map((r) => r.id)).toEqual(['T-0001', 'T-0002']);
    expect(c.done!.map((r) => r.id)).toEqual(['T-0003']);
    expect(Object.values(c).flat().some((r) => r.id === 'T-0004')).toBe(false);
  });
  it('фильтры фаза / исполнитель / возможность', () => {
    expect(boardColumns(records, { phase: 'P-2' }).done).toHaveLength(1);
    expect(boardColumns(records, { assignee: 'ann' }).ready!.map((r) => r.id)).toEqual(['T-0002']);
    expect(boardColumns(records, { capability: 'M-1' }).ready!.map((r) => r.id)).toEqual(['T-0002']);
  });
  it('перенос в ready без подтверждённых документов отклоняется с перечнем причин', () => {
    const task = rec('T-0007', 'task', 'backlog');
    const ready = availableActions(task, context([task])).find((a) => a.status === 'ready');
    expect(ready?.allowed).toBe(false);
    expect(ready!.blockers.length).toBeGreaterThan(0);
  });
});

describe('R-0013 дорожная карта и вехи', () => {
  const records = [
    idx('P-1', 'phase', 'in_progress', { extra: { rank: 2, target: '2026-10-01' }, links: { covers: ['T-0001'] } }),
    idx('P-2', 'phase', 'planned', { extra: { rank: 1 }, links: { covers: ['T-0002'] } }),
    idx('T-0001', 'task', 'ready', { links: { depends_on: ['T-0002'] } }),
    idx('T-0002', 'task', 'in_progress')
  ];
  const road = roadmap(records, '2026-10-11');
  it('фазы по rank, прогресс и блокер из depends_on', () => {
    expect(road.map((p) => p.id)).toEqual(['P-2', 'P-1']);
    expect(road[1]!.blockedBy).toEqual([{ phase: 'P-2', task: 'T-0002' }]);
    expect(road[1]).toMatchObject({ total: 1, done: 0 });
  });
  it('веха просрочена на N дней; законченная фаза — нет', () => {
    expect(road[1]!.overdueDays).toBe(10);
    expect(overdueDays('2026-10-01', '2026-10-11', true)).toBe(0);
    expect(overdueDays('2026-10-20', '2026-10-11', false)).toBe(0);
    expect(overdueDays(null, '2026-10-11', false)).toBe(0);
  });
  it('applyTarget меняет только одну строку и проверяет формат', () => {
    const src = '---\nid: P-1\ntype: phase\ntitle: X\nstatus: planned\n---\n\n# X\n';
    const out = applyTarget(src, '2026-12-01');
    expect(out.problems).toEqual([]);
    expect(out.text).toContain('target: 2026-12-01');
    expect(out.text).toContain('# X');
    expect(applyTarget(src, '1.12.2026').problems).not.toEqual([]);
    expect(applyTarget(out.text, null).text).not.toContain('target:');
  });
});

describe('Менеджер и релизы: минимум роли (docs/04-ui.md)', () => {
  const records = [
    idx('T-0001', 'task', 'done'),
    idx('T-0002', 'task', 'done', { extra: { assignee: 'ann' } }),
    idx('T-0003', 'task', 'ready'),
    idx('L-0001', 'release', 'approved', { links: { ships: ['T-0001'] } })
  ];
  it('фильтр «Без исполнителя»', () => {
    expect(boardColumns(records, { assignee: NO_ASSIGNEE }).done!.map((r) => r.id)).toEqual(['T-0001']);
  });
  it('готово к выпуску — закрытые задачи вне релизов, новые сверху', () => {
    expect(unshippedTasks(records).map((r) => r.id)).toEqual(['T-0002']);
  });
});
