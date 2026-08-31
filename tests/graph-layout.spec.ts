import { describe, expect, it } from 'vitest';

import { layoutGraph, nodeShape } from '../app/utils/graph-layout';
import type { IndexRecord, LinkKind } from '../server/lib/types';

/**
 * Укладка детерминированная (ADR-0006): одни и те же записи дают одну и ту же
 * картинку. Это и проверяется — без браузера, потому что это чистая функция.
 */

function node(
  id: string,
  type: string,
  status = 'approved',
  links: Partial<Record<LinkKind, string[]>> = {},
  backlinks: Partial<Record<LinkKind, string[]>> = {}
): IndexRecord {
  return {
    id,
    type,
    title: `Запись ${id}`,
    status,
    owner: null,
    created: null,
    updated: null,
    phase: null,
    tags: [],
    path: `docs/development/${type}/${id}.md`,
    section: null,
    links,
    backlinks,
    extra: {}
  };
}

describe('layoutGraph', () => {
  it('раскладывает типы по колонкам в порядке контракта', () => {
    const layout = layoutGraph([
      node('V-0001', 'verification'),
      node('T-0001', 'task'),
      node('R-0001', 'requirement'),
      node('D-0001', 'design')
    ]);

    const x = (id: string) => layout.nodes.find((item) => item.id === id)?.x ?? -1;
    expect(x('R-0001')).toBeLessThan(x('D-0001'));
    expect(x('D-0001')).toBeLessThan(x('T-0001'));
    expect(x('T-0001')).toBeLessThan(x('V-0001'));
  });

  it('одни и те же записи дают одну и ту же картинку', () => {
    const records = [node('T-0002', 'task'), node('T-0001', 'task'), node('R-0001', 'requirement')];
    const first = layoutGraph(records);
    const second = layoutGraph([...records].reverse());
    expect(JSON.stringify(first.nodes)).toBe(JSON.stringify(second.nodes));
  });

  it('пропускает пустые колонки, а не оставляет дыру', () => {
    const layout = layoutGraph([node('R-0001', 'requirement'), node('V-0001', 'verification')]);
    expect(layout.columns.map((column) => column.title)).toEqual(['Требования', 'Проверки']);
  });

  it('находит висящий узел', () => {
    const layout = layoutGraph([
      node('R-0001', 'requirement', 'approved', {}, { implements: ['T-0001'] }),
      node('T-0001', 'task', 'ready', { implements: ['R-0001'] }),
      node('D-0009', 'design')
    ]);
    expect(layout.nodes.filter((item) => item.dangling).map((item) => item.id)).toEqual(['D-0009']);
  });

  it('ссылку в никуда не рисует: о ней говорит link_broken', () => {
    const layout = layoutGraph([node('T-0001', 'task', 'ready', { implements: ['R-9999'] })]);
    expect(layout.edges).toEqual([]);
  });

  it('связь между размещёнными узлами превращается в ребро', () => {
    const layout = layoutGraph([
      node('R-0001', 'requirement'),
      node('T-0001', 'task', 'ready', { implements: ['R-0001'] })
    ]);
    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({ from: 'T-0001', to: 'R-0001', kind: 'implements' });
  });

  it('размер холста растёт вместе с самой длинной колонкой', () => {
    const short = layoutGraph([node('T-0001', 'task')]);
    const long = layoutGraph([node('T-0001', 'task'), node('T-0002', 'task'), node('T-0003', 'task')]);
    expect(long.height).toBeGreaterThan(short.height);
  });

  it('запись незнакомого типа не прячет, а кладёт в «Прочее»', () => {
    const layout = layoutGraph([node('R-0001', 'requirement'), node('A-0009', 'adr')]);
    expect(layout.columns.map((column) => column.title)).toEqual(['Требования', 'Прочее']);
    expect(layout.nodes.map((item) => item.id)).toContain('A-0009');
  });

  it('пустой проект даёт пустую картинку, а не ошибку', () => {
    const layout = layoutGraph([]);
    expect(layout.nodes).toEqual([]);
    expect(layout.edges).toEqual([]);
  });
});

describe('nodeShape', () => {
  it('различает подтверждённое, отменённое и то, что в работе', () => {
    expect(nodeShape('done').corner).toBe(true);
    expect(nodeShape('dropped').dashed).toBe(true);
    expect(nodeShape('in_progress').rx).toBeGreaterThan(nodeShape('backlog').rx);
  });
});
