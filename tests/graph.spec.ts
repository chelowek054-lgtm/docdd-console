import { describe, expect, it } from 'vitest';

import { buildGraph, findDependencyCycles, incomingEdges, outgoing } from '../server/lib/graph';
import { latestVerificationResults } from '../server/lib/reports';
import type { Report } from '../server/lib/types';
import { rec } from './helpers';

describe('buildGraph', () => {
  it('строит обратные связи: в файлах их нет', () => {
    const graph = buildGraph([
      rec('R-0004', 'requirement', 'approved'),
      rec('T-0007', 'task', 'ready', { links: { implements: ['R-0004'] } })
    ]);

    expect(outgoing(graph, 'T-0007', 'implements').map((edge) => edge.to)).toEqual(['R-0004']);
    expect(incomingEdges(graph, 'R-0004', 'implements').map((edge) => edge.from)).toEqual(['T-0007']);
  });

  it('замечает повторённый идентификатор и оставляет в индексе первую запись', () => {
    const first = rec('T-0007', 'task', 'ready', { path: 'docs/development/tasks/T-0007-a.md' });
    const second = rec('T-0007', 'task', 'backlog', { path: 'docs/development/tasks/T-0007-b.md' });
    const graph = buildGraph([first, second]);

    expect(graph.duplicates).toEqual(['T-0007']);
    expect(graph.byId.get('T-0007')?.source.path).toBe('docs/development/tasks/T-0007-a.md');
  });

  it('не считает дублями записи без идентификатора', () => {
    const graph = buildGraph([
      rec('', 'task', 'ready', { path: 'a.md' }),
      rec('', 'task', 'ready', { path: 'b.md' })
    ]);
    expect(graph.duplicates).toEqual([]);
  });
});

describe('findDependencyCycles', () => {
  it('находит цикл из двух задач', () => {
    const graph = buildGraph([
      rec('T-0001', 'task', 'backlog', { links: { depends_on: ['T-0002'] } }),
      rec('T-0002', 'task', 'backlog', { links: { depends_on: ['T-0001'] } })
    ]);
    expect(findDependencyCycles(graph)).toEqual([['T-0001', 'T-0002']]);
  });

  it('находит цикл из трёх задач ровно один раз', () => {
    const graph = buildGraph([
      rec('T-0001', 'task', 'backlog', { links: { depends_on: ['T-0002'] } }),
      rec('T-0002', 'task', 'backlog', { links: { depends_on: ['T-0003'] } }),
      rec('T-0003', 'task', 'backlog', { links: { depends_on: ['T-0001'] } })
    ]);
    expect(findDependencyCycles(graph)).toEqual([['T-0001', 'T-0002', 'T-0003']]);
  });

  it('молчит на цепочке и на общей зависимости двух задач', () => {
    const graph = buildGraph([
      rec('T-0001', 'task', 'backlog', { links: { depends_on: ['T-0003'] } }),
      rec('T-0002', 'task', 'backlog', { links: { depends_on: ['T-0003'] } }),
      rec('T-0003', 'task', 'backlog')
    ]);
    expect(findDependencyCycles(graph)).toEqual([]);
  });

  it('ссылку в никуда циклом не считает', () => {
    const graph = buildGraph([rec('T-0001', 'task', 'backlog', { links: { depends_on: ['T-9999'] } })]);
    expect(findDependencyCycles(graph)).toEqual([]);
  });
});

describe('latestVerificationResults', () => {
  const report = (started: string, verifications: Report['verifications']): Report => ({
    contract: 'docdd.workspace/1',
    runner: 'npm',
    started_at: started,
    verifications
  });

  it('поздний прогон перекрывает ранний', () => {
    const results = latestVerificationResults([
      report('2026-08-30T10:00:00Z', { 'V-0004': 'failed' }),
      report('2026-08-31T10:00:00Z', { 'V-0004': 'passed' })
    ]);
    expect(results.get('V-0004')).toBe('passed');
  });

  it('порядок в списке значения не имеет: считается время начала', () => {
    const results = latestVerificationResults([
      report('2026-08-31T10:00:00Z', { 'V-0004': 'passed' }),
      report('2026-08-30T10:00:00Z', { 'V-0004': 'failed' })
    ]);
    expect(results.get('V-0004')).toBe('passed');
  });

  it('проверка, не упомянутая ни в одном отчёте, остаётся без результата', () => {
    const results = latestVerificationResults([report('2026-08-30T10:00:00Z', { 'V-0004': 'passed' })]);
    expect(results.has('V-0007')).toBe(false);
  });
});
