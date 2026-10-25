// Сроки и фактическое время задач (V-0108, R-0102, ADR-0039).
import { describe, expect, it } from 'vitest';

import { applyDueFromTag, applyStatusChange, statusOfJournalAction } from '../server/lib/actions';
import { estimateExceeded, phaseOverdue, taskOverdue } from '../server/lib/rules';
import { validateFrontMatter } from '../server/lib/schema';
import { analytics, dueFromTags, localToEpoch, parseEstimate, parseJournal, phaseTiming, projectTimings, stampAt, taskTiming, timingsCsv } from '../server/lib/timing';
import { VIOLATION_LEVELS } from '../server/lib/types';
import { context, rec } from './helpers';

const journal = (...lines: string[]) => `# Задача\n\nТекст.\n\n## Журнал\n\n${lines.map((line) => `- ${line}`).join('\n')}\n`;
const NOW = new Date('2026-10-25T12:00:00Z');

describe('журнал со временем и без', () => {
  it('строка со временем и без читается; без времени — начало дня', () => {
    const events = parseJournal(journal('2026-10-20 · заведена · приложение', '2026-10-21 14:03 · в разработку · developer'), 'UTC');
    expect(events.map((event) => [event.date, event.time, event.status, event.actor])).toEqual([
      ['2026-10-20', null, null, 'приложение'],
      ['2026-10-21', '14:03', 'in_progress', 'developer']
    ]);
    expect(events[0]?.at).toBe(Date.parse('2026-10-20T00:00:00Z'));
  });

  it('часовой пояс проекта учитывается: 14:03 по Москве — 11:03 UTC', () => {
    expect(localToEpoch('2026-10-21', '14:03', 'Europe/Moscow')).toBe(Date.parse('2026-10-21T11:03:00Z'));
    expect(stampAt(new Date('2026-10-21T11:03:00Z'), 'Europe/Moscow')).toBe('2026-10-21 14:03');
    // Незнакомый пояс — не падение, а время сервера.
    expect(stampAt(new Date('2026-10-21T11:03:00Z'), 'Nowhere/City')).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('смена статуса пишет строку со временем, а в updated — только дату', () => {
    const original = `---\nid: T-0001\ntype: task\ntitle: Задача\nstatus: ready\ncreated: 2026-10-20\nupdated: 2026-10-20\nlinks: {}\n---\n\n# Задача\n\n## Журнал\n\n- 2026-10-20 · заведена · приложение\n`;
    const outcome = applyStatusChange(original, { status: 'in_progress', actor: 'developer', today: '2026-10-25 14:03' });
    expect(outcome.problems).toEqual([]);
    expect(outcome.text).toContain('updated: 2026-10-25\n');
    expect(outcome.text).toContain('- 2026-10-25 14:03 · в разработку · developer');
  });

  it('слово журнала читается обратно в статус, в том числе с пояснением', () => {
    expect(statusOfJournalAction('на проверку: строка проверена')).toBe('in_review');
    expect(statusOfJournalAction('в legacy: курс сменился')).toBe('legacy');
    expect(statusOfJournalAction('подтверждено после просмотра разницы')).toBe('approved');
    expect(statusOfJournalAction('исполнитель: developer')).toBeNull();
  });
});

describe('estimate', () => {
  it('30m, 2h, 1d разбираются; день — восемь часов', () => {
    expect([parseEstimate('30m'), parseEstimate('2h'), parseEstimate('1d'), parseEstimate('1.5h')]).toEqual([30, 120, 480, 90]);
  });

  it('кривое значение — нарушение схемы, а не ноль', () => {
    expect(parseEstimate('два часа')).toBeNull();
    const base = { id: 'T-0001', type: 'task', title: 'З', status: 'backlog', created: '2026-10-20', updated: '2026-10-20', links: {} };
    expect(validateFrontMatter({ ...base, estimate: '2h', due: '2026-10-26' })).toEqual([]);
    expect(validateFrontMatter({ ...base, estimate: 'два часа' }).length).toBeGreaterThan(0);
  });
});

describe('тайминги задачи на записях с известным ответом', () => {
  const doc = rec('D-0001', 'design', 'approved', { body: journal('2026-10-20 · заведена · приложение', '2026-10-20 15:00 · подтверждён · architect') });
  const task = rec('T-0001', 'task', 'done', {
    links: { documents: ['D-0001'] },
    extra: { estimate: '2h', due: '2026-10-21', change: 'feature', assignee: 'developer' },
    body: journal(
      '2026-10-20 09:00 · заведена · приложение',
      '2026-10-20 10:00 · готова к работе · architect',
      '2026-10-20 11:00 · в разработку · developer',
      '2026-10-20 13:00 · на проверку · developer',
      '2026-10-20 14:00 · в разработку · developer',
      '2026-10-20 15:00 · на проверку · developer',
      '2026-10-22 09:00 · закрыта · architect'
    )
  });
  const byId = new Map([doc, task].map((record) => [record.id, record]));

  it('lead, cycle, время в статусах с возвратом, ожидание документов, оценка и просрочка', () => {
    const timing = taskTiming(task, byId, NOW, 'UTC');
    expect(timing.leadMinutes).toBe((48) * 60);
    expect(timing.cycleMinutes).toBe(46 * 60);
    expect(timing.inStatus).toEqual({ backlog: 60, ready: 60, in_progress: 180, in_review: 60 + 42 * 60 });
    expect(timing.factMinutes).toBe(180);
    expect(timing.estimateMinutes).toBe(120);
    expect(timing.waitingDocsMinutes).toBe(6 * 60);
    expect(timing.overdueDays).toBe(1);
    expect(timing.daysLeft).toBeNull();
    expect(timing.precise).toBe(true);
    expect(timing.done).toBe('2026-10-22 09:00');
  });

  it('старый журнал без времени — точность до дня, расчёт не ломается', () => {
    const old = rec('T-0002', 'task', 'in_progress', { body: journal('2026-10-20 · заведена · приложение', '2026-10-22 · в разработку · developer'), extra: { due: '2026-10-30' } });
    const timing = taskTiming(old, new Map(), NOW, 'UTC');
    expect(timing.precise).toBe(false);
    expect(timing.inStatus['backlog']).toBe(2 * 1440);
    expect(timing.daysLeft).toBe(5);
    expect(timing.overdueDays).toBe(0);
  });

  it('фаза: срок, просрочка и прогноз по скорости закрытия', () => {
    const tasks = [taskTiming(task, byId, NOW, 'UTC'), { ...taskTiming(task, byId, NOW, 'UTC'), id: 'T-0009', status: 'in_progress', done: null }];
    const phase = phaseTiming(rec('P-0001', 'phase', 'active', { extra: { target: '2026-10-24' } }), tasks, NOW, 'UTC');
    expect(phase).toMatchObject({ due: '2026-10-24', total: 2, done: 1, overdueDays: 1, forecast: '2026-11-22' });
  });

  it('аналитика и выгрузка сходятся с расчётом задачи', () => {
    const all = projectTimings([doc, task], NOW, 'UTC');
    expect(all.analytics.byChange).toEqual([{ key: 'feature', agent: false, count: 1, leadAvg: 2880, cycleAvg: 2760 }]);
    expect(all.analytics.estimates).toEqual({ count: 1, ratioAvg: 1.5, withinQuarter: 0 });
    expect(analytics(all.tasks, NOW, 'UTC').weeks.find((week) => week.week === '2026-10-19')?.closed).toBe(1);
    const csv = timingsCsv(all.tasks).split('\n');
    expect(csv[0]).toContain('lead_h,cycle_h');
    expect(csv[1]).toContain('T-0001');
    expect(csv[1]).toContain(',48,46,');
  });
});

describe('перенос срока из тега', () => {
  it('due-2026-10-26 → due: 2026-10-26, тег убран, строка в журнале, незнакомые поля на месте', () => {
    const original = `---\nid: T-0003\ntype: task\ntitle: Задача\nstatus: backlog\ncreated: 2026-10-20\nupdated: 2026-10-20\nmine: своё поле\ntags: [client, due-2026-10-26]\nlinks: {}\n---\n\n# Задача\n\n## Журнал\n\n- 2026-10-20 · заведена · приложение\n`;
    const moved = dueFromTags(['client', 'due-2026-10-26']);
    expect(moved).toEqual({ due: '2026-10-26', tags: ['client'] });
    const outcome = applyDueFromTag(original, { ...moved!, actor: 'architect', today: '2026-10-25 10:00' });
    expect(outcome.problems).toEqual([]);
    expect(outcome.text).toContain('tags: [client]');
    expect(outcome.text).toContain('due: 2026-10-26');
    expect(outcome.text).toContain('mine: своё поле');
    expect(outcome.text).toContain('- 2026-10-25 10:00 · срок перенесён из тега: 2026-10-26 · architect');
    expect(dueFromTags(['client'])).toBeNull();
  });
});

describe('правила сроков — предупреждения', () => {
  it('task_overdue, phase_overdue, estimate_exceeded', () => {
    const late = rec('T-0001', 'task', 'in_progress', { extra: { due: '2026-08-20', estimate: '1h' }, body: journal('2026-08-29 08:00 · в разработку · developer') });
    const closed = rec('T-0002', 'task', 'done', { extra: { due: '2026-08-20' } });
    const phase = rec('P-0001', 'phase', 'active', { links: { covers: ['T-0001', 'T-0002'] }, extra: { due: '2026-08-25' } });
    const ctx = context([late, closed, phase], { now: '2026-08-30' });
    expect(taskOverdue(ctx).map((item) => item.id)).toEqual(['T-0001']);
    expect(phaseOverdue(ctx).map((item) => item.id)).toEqual(['P-0001']);
    expect(estimateExceeded(ctx).map((item) => item.id)).toEqual(['T-0001']);
    expect([VIOLATION_LEVELS.task_overdue, VIOLATION_LEVELS.phase_overdue, VIOLATION_LEVELS.estimate_exceeded]).toEqual(['warning', 'warning', 'warning']);
  });

  it('без срока и оценки правил нет', () => {
    const plain = rec('T-0001', 'task', 'in_progress', { body: journal('2026-08-01 · в разработку · developer') });
    const ctx = context([plain], { now: '2026-08-30' });
    expect([...taskOverdue(ctx), ...phaseOverdue(ctx), ...estimateExceeded(ctx)]).toEqual([]);
  });
});
