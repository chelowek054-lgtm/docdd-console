import { describe, expect, it } from 'vitest';

import {
  ancestors, cyclesAt, depthOf, foldEdges, groupCohesion, maxDepth, splitHintTexts, splitHints, visibleAncestor, visibleAt,
  type TreeNode
} from '../server/lib/hierarchy';

/** Вложенность карт (R-0040, ADR-0027): свёртка связей, циклы, подсказки дробления. */

const tree: TreeNode[] = [
  { id: 'a' }, { id: 'a1', parent: 'a' }, { id: 'a11', parent: 'a1' }, { id: 'a12', parent: 'a1' },
  { id: 'a2', parent: 'a' }, { id: 'b' }, { id: 'b1', parent: 'b' }
];

describe('глубина и предки', () => {
  it('предки идут от родителя к корню, глубина считается по ним', () => {
    expect(ancestors('a11', tree)).toEqual(['a1', 'a']);
    expect(depthOf('a11', tree)).toBe(2);
    expect(depthOf('a', tree)).toBe(0);
    expect(maxDepth(tree)).toBe(2);
    expect(maxDepth([])).toBe(0);
  });

  it('цикл parent и родитель-призрак не роняют расчёт', () => {
    const bad: TreeNode[] = [{ id: 'x', parent: 'y' }, { id: 'y', parent: 'x' }, { id: 'z', parent: 'нет' }];
    expect(ancestors('x', bad)).toEqual(['y']);
    expect(depthOf('z', bad)).toBe(0);
  });
});

describe('visibleAncestor / visibleAt', () => {
  it('видимый узел — предок не глубже уровня, лист остаётся собой', () => {
    expect(visibleAncestor('a11', tree, 0)).toBe('a');
    expect(visibleAncestor('a11', tree, 1)).toBe('a1');
    expect(visibleAncestor('a11', tree, 9)).toBe('a11');
    expect(visibleAncestor('b1', tree, -1)).toBe('b');
  });

  it('раскрытая на месте группа: внутри — уровень ниже неё, снаружи — свёрнуто до её уровня', () => {
    expect(visibleAt('a11', tree, 'a1', 1)).toBe('a11');
    expect(visibleAt('a11', tree, 'a', 1)).toBe('a1');
    expect(visibleAt('b1', tree, 'a1', 1)).toBe('b1');
    expect(visibleAt('a2', tree, 'a1', 1)).toBe('a2');
    expect(visibleAt('a11', tree, null, 0)).toBe('a');
  });
});

describe('foldEdges', () => {
  const edges = [
    { from: 'a11', to: 'b1', kind: 'uses', verdict: 'ok' },
    { from: 'a12', to: 'b1', kind: 'depends', verdict: 'broken' },
    { from: 'a11', to: 'a12', kind: 'uses' },
    { from: 'a2', to: 'b1' }
  ];
  const worst = (v: string[]) => (v.includes('broken') ? 'broken' : v[0] ?? '');

  it('связи складываются в стрелку между видимыми предками: число, виды, худший вердикт', () => {
    const r = foldEdges(edges, (id) => visibleAncestor(id, tree, 0), worst);
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0]).toMatchObject({ from: 'a', to: 'b', count: 3, kinds: ['uses', 'depends'], worst: 'broken' });
    expect(r.internal).toBe(1);
  });

  it('стрелку можно развернуть до исходных связей; на нижнем уровне ничего не теряется', () => {
    const top = foldEdges(edges, (id) => visibleAncestor(id, tree, 0), worst);
    expect(top.edges[0]?.members).toEqual(edges.filter((e) => e.to === 'b1'));
    const deep = foldEdges(edges, (id) => visibleAncestor(id, tree, 9), worst);
    expect(deep.edges).toHaveLength(4);
    expect(deep.internal).toBe(0);
    expect(deep.edges.reduce((sum, e) => sum + e.count, 0) + deep.internal).toBe(edges.length);
  });

  it('без вердиктов worst не задан; пустые связи дают пустой результат', () => {
    expect(foldEdges([{ from: 'a2', to: 'b1' }], (id) => id).edges[0]?.worst).toBeUndefined();
    expect(foldEdges([], (id) => id)).toEqual({ edges: [], internal: 0 });
  });
});

describe('cyclesAt', () => {
  it('находит циклы между видимыми узлами и не считает петли', () => {
    expect(cyclesAt([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'd', to: 'd' }])[0]?.sort())
      .toEqual(['a', 'b', 'c']);
    expect(cyclesAt([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }])).toEqual([]);
    expect(cyclesAt([])).toEqual([]);
  });

  it('цикл возникает только при свёртке: на нижнем уровне его нет', () => {
    const edges = [{ from: 'a11', to: 'b1' }, { from: 'b1', to: 'a2' }];
    const at = (level: number) => foldEdges(edges, (id) => visibleAncestor(id, tree, level)).edges;
    expect(cyclesAt(at(9))).toEqual([]);
    expect(cyclesAt(at(0))).toHaveLength(1);
  });
});

describe('подсказки дробления', () => {
  const wide: TreeNode[] = [{ id: 'g' }, ...Array.from({ length: 10 }, (_, i) => ({ id: `c${i}`, parent: 'g' }))];

  it('больше девяти детей, один ребёнок, наружу больше, чем внутри', () => {
    expect(splitHints('g', wide, [])).toContain('too_many_children');
    expect(splitHints('a1', tree, [])).not.toContain('single_child');
    expect(splitHints('b', tree, [])).toContain('single_child');
    const edges = [{ from: 'a11', to: 'b1' }, { from: 'a12', to: 'b1' }, { from: 'a11', to: 'a12' }];
    expect(groupCohesion('a1', tree, edges)).toEqual({ inside: 1, outside: 2 });
    expect(splitHints('a1', tree, edges)).toContain('more_outside_than_inside');
  });

  it('тексты по кодам по-русски, неизвестный код пропускается', () => {
    const texts = splitHintTexts(['too_many_children', 'single_child', 'more_outside_than_inside', 'cycle', 'неизвестно'],
      { title: 'Сервер', children: 12, inside: 1, outside: 4, cycle: ['a', 'b'] });
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain('12');
    expect(texts[2]).toContain('внутри 1, наружу 4');
    expect(texts[3]).toContain('a → b');
  });
});
