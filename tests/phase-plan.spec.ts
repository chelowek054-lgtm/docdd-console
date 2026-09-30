import { describe, expect, it } from 'vitest';

import type { ProposedRecord } from '../server/lib/inbox';
import { asProposals, phaseCandidates, planPhases } from '../server/lib/phase-plan';
import { phasesPrompt } from '../server/lib/prompt';
import type { IndexRecord } from '../server/lib/types';

/**
 * Разбиение задач на фазы: что отдавать модели и что из ответа можно завести
 * (docs/04-ui.md, «Разбить на фазы»).
 */

function item(id: string, type: string, status: string, extra: Partial<IndexRecord> = {}): IndexRecord {
  return {
    id, type, status, title: `Запись ${id}`, owner: null, created: null, updated: null, phase: null,
    tags: [], path: `docs/development/${id}.md`, section: null, links: {}, backlinks: {}, extra: {}, ...extra
  };
}

function phase(key: string, title: string, covers: string[], type = 'phase'): ProposedRecord {
  return { key, type: type as ProposedRecord['type'], title, links: { covers } };
}

const records = [
  item('T-0001', 'task', 'backlog'),
  item('T-0002', 'task', 'ready'),
  item('T-0003', 'task', 'dropped'),
  item('T-0004', 'task', 'backlog', { phase: 'P-0001' }),
  item('T-0005', 'task', 'backlog'),
  item('P-0001', 'phase', 'planned', { links: { covers: ['T-0005'] } }),
  item('R-0001', 'requirement', 'approved')
];

describe('phaseCandidates', () => {
  it('берёт задачи, что не отменены и ни в какой фазе — ни по covers, ни по полю phase', () => {
    expect(phaseCandidates(records).map((task) => task.id)).toEqual(['T-0001', 'T-0002']);
  });

  it('отмеченные, но неподходящие, отбрасываются', () => {
    expect(phaseCandidates(records, ['T-0002', 'T-0003', 'T-0004', 'R-0001']).map((task) => task.id)).toEqual(['T-0002']);
  });
});

describe('planPhases', () => {
  it('заводит фазу с составом и называет задачи, не попавшие никуда', () => {
    const plan = planPhases([phase('a', 'Основа', ['T-0001'])], records);
    expect(plan.phases).toEqual([{ key: 'a', title: 'Основа', covers: ['T-0001'] }]);
    expect(plan.uncovered).toEqual(['T-0002']);
    expect(plan.problems).toEqual([]);
  });

  it('задача в двух фазах остаётся в первой', () => {
    const plan = planPhases([phase('a', 'Одна', ['T-0001']), phase('b', 'Другая', ['T-0001', 'T-0002'])], records);
    expect(plan.phases.map((entry) => entry.covers)).toEqual([['T-0001'], ['T-0002']]);
    expect(plan.problems.join(' ')).toContain('T-0001 уже в предыдущей фазе');
  });

  it('снимает из состава чужое: несуществующее, не задачу, занятую и отменённую', () => {
    const plan = planPhases(
      [phase('a', 'Основа', ['T-0001', 'T-9999', 'R-0001', 'T-0005', 'T-0003'])],
      records
    );
    expect(plan.phases[0]?.covers).toEqual(['T-0001']);
    const text = plan.problems.join(' ');
    expect(text).toContain('T-9999');
    expect(text).toContain('не задача');
    expect(text).toContain('T-0005 уже состоит в фазе');
    expect(text).toContain('T-0003 отменена');
  });

  it('пропускает записи не типа phase и фазы без состава или названия', () => {
    const plan = planPhases(
      [phase('a', 'Задача', ['T-0001'], 'task'), phase('b', 'Пустая', ['T-9999']), phase('c', ' ', ['T-0002'])],
      records
    );
    expect(plan.phases).toEqual([]);
    expect(plan.problems).toHaveLength(4);
  });

  it('набор ограничен тем, что ушло модели', () => {
    const plan = planPhases([phase('a', 'Основа', ['T-0001', 'T-0002'])], records, ['T-0002']);
    expect(plan.phases[0]?.covers).toEqual(['T-0002']);
    expect(plan.problems.join(' ')).toContain('не входит в набор');
  });

  it('asProposals отдаёт createRecords тип phase и связь covers', () => {
    expect(asProposals([{ key: 'a', title: 'Основа', body: 'Цель', covers: ['T-0001'] }])).toEqual([
      { key: 'a', type: 'phase', title: 'Основа', body: 'Цель', links: { covers: ['T-0001'] } }
    ]);
  });
});

describe('phasesPrompt', () => {
  it('подставляет задачи с фактами и заведённые фазы, шапку шаблона убирает', () => {
    const template = 'шапка\n---\nФазы:\n<!-- ФАЗЫ -->\nЗадачи:\n<!-- ЗАДАЧИ -->';
    const text = phasesPrompt(
      template,
      [{ id: 'T-0001', title: 'Вход', status: 'backlog', path: 'tasks/T-0001.md', implements: ['R-0001'], dependsOn: ['T-0002'], tags: ['auth'] }],
      [{ id: 'P-0001', title: 'Основа', covers: 3 }]
    );
    expect(text).not.toContain('шапка');
    expect(text).toContain('`T-0001` — Вход (статус: backlog; выполняет: R-0001; зависит от: T-0002; теги: auth)');
    expect(text).toContain('`P-0001` — Основа (задач: 3)');
  });

  it('без фаз так и говорит', () => {
    expect(phasesPrompt('-\n---\n<!-- ФАЗЫ -->', [], [])).toContain('Фаз пока нет');
  });
});
