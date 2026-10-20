import { describe, expect, it } from 'vitest';

import {
  ancestors,
  cyclesAt,
  depthOf,
  foldEdges,
  groupCohesion,
  maxDepth,
  splitHints,
  splitHintTexts,
  visibleAncestor,
  visibleAt,
  type Edge,
  type TreeNode
} from '../server/lib/hierarchy';

/**
 * Иерархия карт (ADR-0027, R-0040): предки, видимый предок, свёртка связей,
 * связность группы, циклы на уровне, подсказки дробления.
 */

// Оплата > Возвраты > Частичный; Оплата > Карта; рядом Каталог > Поиск.
const tree: TreeNode[] = [
  { id: 'pay' },
  { id: 'refund', parent: 'pay' },
  { id: 'partial', parent: 'refund' },
  { id: 'card', parent: 'pay' },
  { id: 'catalog' },
  { id: 'search', parent: 'catalog' }
];

describe('предки и глубина', () => {
  it('предки от родителя к корню; у корня их нет', () => {
    expect(ancestors('partial', tree)).toEqual(['refund', 'pay']);
    expect(ancestors('pay', tree)).toEqual([]);
    expect(ancestors('нет-такого', tree)).toEqual([]);
  });

  it('глубина узла и глубина дерева', () => {
    expect(depthOf('pay', tree)).toBe(0);
    expect(depthOf('partial', tree)).toBe(2);
    expect(maxDepth(tree)).toBe(2);
    expect(maxDepth([])).toBe(0);
  });

  it('цикл в parent обрывается и не зависает', () => {
    const loop: TreeNode[] = [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }];
    expect(ancestors('a', loop)).toEqual(['b']);
    expect(depthOf('b', loop)).toBe(1);
  });

  it('родитель-призрак делает узел корнем; сам себе родитель — тоже', () => {
    expect(ancestors('x', [{ id: 'x', parent: 'ghost' }])).toEqual([]);
    expect(ancestors('x', [{ id: 'x', parent: 'x' }])).toEqual([]);
  });
});

describe('видимый предок на уровне', () => {
  it('уровень 0 — корень, глубже — по цепочке, глубже узла — сам узел', () => {
    expect(visibleAncestor('partial', tree, 0)).toBe('pay');
    expect(visibleAncestor('partial', tree, 1)).toBe('refund');
    expect(visibleAncestor('partial', tree, 2)).toBe('partial');
    expect(visibleAncestor('partial', tree, 9)).toBe('partial');
    expect(visibleAncestor('pay', tree, 3)).toBe('pay');
  });

  it('отрицательный уровень не ломает расчёт: берётся корень', () => {
    expect(visibleAncestor('partial', tree, -4)).toBe('pay');
  });

  it('раскрытая на месте группа показывает свой уровень, снаружи — уровень самой группы', () => {
    // раскрыли «Оплата»: внутри уровень 1 ниже неё, соседи свёрнуты до корня
    expect(visibleAt('partial', tree, 'pay', 1)).toBe('refund');
    expect(visibleAt('card', tree, 'pay', 1)).toBe('card');
    expect(visibleAt('search', tree, 'pay', 1)).toBe('catalog');
    // раскрыли «Возвраты» (глубина 1): снаружи свёрнуто до глубины 1
    expect(visibleAt('card', tree, 'refund', 1)).toBe('card');
    expect(visibleAt('partial', tree, 'refund', 1)).toBe('partial');
  });

  it('без раскрытой группы — как visibleAncestor; неизвестная группа ничего не раскрывает', () => {
    expect(visibleAt('partial', tree, null, 1)).toBe('refund');
    expect(visibleAt('partial', tree, 'нет', 3)).toBe('pay');
  });
});

describe('свёртка связей до видимого уровня', () => {
  const edges: Edge[] = [
    { from: 'partial', to: 'card', kind: 'calls', verdict: 'ok' },
    { from: 'refund', to: 'card', kind: 'reads', verdict: 'stale' },
    { from: 'card', to: 'search', kind: 'calls', verdict: 'ok' },
    { from: 'search', to: 'catalog', kind: 'calls' }
  ];

  it('на верхнем уровне: стрелка между видимыми предками, внутренние считаются отдельно', () => {
    const r = foldEdges(edges, (id) => visibleAncestor(id, tree, 0));
    expect(r.internal).toBe(3);
    expect(r.edges).toHaveLength(1);
    const e = r.edges[0]!;
    expect([e.from, e.to, e.count]).toEqual(['pay', 'catalog', 1]);
  });

  it('на уровне 1 стрелки множатся, у каждой число, виды и опора внизу', () => {
    const r = foldEdges(edges, (id) => visibleAncestor(id, tree, 1));
    const refundToCard = r.edges.find((e) => e.from === 'refund' && e.to === 'card')!;
    expect(refundToCard.count).toBe(2);
    expect(refundToCard.kinds).toEqual(['calls', 'reads']);
    expect(refundToCard.members).toEqual([edges[0], edges[1]]);
  });

  it('число связей сохраняется: стрелки плюс внутренние равны исходным', () => {
    for (const level of [0, 1, 2]) {
      const r = foldEdges(edges, (id) => visibleAncestor(id, tree, level));
      const arrows = r.edges.reduce((sum, e) => sum + e.count, 0);
      expect(arrows + r.internal).toBe(edges.length);
    }
  });

  it('худший вердикт выбирает переданное правило; без вердиктов — undefined', () => {
    const rank = ['ok', 'stale', 'missing'];
    const worst = (v: string[]) => v.reduce((a, b) => (rank.indexOf(b) > rank.indexOf(a) ? b : a));
    const r = foldEdges(edges, (id) => visibleAncestor(id, tree, 1), worst);
    expect(r.edges.find((e) => e.from === 'refund' && e.to === 'card')!.worst).toBe('stale');
    const bare = foldEdges([{ from: 'a', to: 'b' }], (id) => id);
    expect(bare.edges[0]!.worst).toBeUndefined();
  });

  it('направление не теряется: A → B и B → A — разные стрелки', () => {
    const r = foldEdges([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }], (id) => id);
    expect(r.edges).toHaveLength(2);
  });

  it('пустой список связей — пустая свёртка', () => {
    expect(foldEdges([], (id) => id)).toEqual({ edges: [], internal: 0 });
  });
});

describe('связность группы', () => {
  const edges: Edge[] = [
    { from: 'partial', to: 'card' },
    { from: 'refund', to: 'partial' },
    { from: 'card', to: 'search' },
    { from: 'search', to: 'catalog' }
  ];

  it('внутри — оба конца в поддереве группы, наружу — один, в любую сторону', () => {
    expect(groupCohesion('pay', tree, edges)).toEqual({ inside: 2, outside: 1 });
    expect(groupCohesion('catalog', tree, edges)).toEqual({ inside: 1, outside: 1 });
  });

  it('группа без связей — нули', () => {
    expect(groupCohesion('pay', tree, [])).toEqual({ inside: 0, outside: 0 });
  });
});

describe('циклы между видимыми узлами', () => {
  it('цикл из двух и из трёх; порядок членов не важен', () => {
    const two = cyclesAt([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }]);
    expect(two.map((c) => [...c].sort())).toEqual([['a', 'b']]);
    const three = cyclesAt([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'c', to: 'a' }, { from: 'c', to: 'd' }]);
    expect(three.map((c) => [...c].sort())).toEqual([['a', 'b', 'c']]);
  });

  it('цепочка без возврата и петля на себя циклом не считаются', () => {
    expect(cyclesAt([{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }])).toEqual([]);
    expect(cyclesAt([{ from: 'a', to: 'a' }])).toEqual([]);
    expect(cyclesAt([])).toEqual([]);
  });

  it('два независимых цикла находятся оба', () => {
    const r = cyclesAt([
      { from: 'a', to: 'b' }, { from: 'b', to: 'a' },
      { from: 'x', to: 'y' }, { from: 'y', to: 'x' }
    ]);
    expect(r).toHaveLength(2);
  });

  it('цикл появляется только на нужном уровне: внизу цепочка, наверху цикл', () => {
    const raw: Edge[] = [{ from: 'card', to: 'search' }, { from: 'search', to: 'refund' }];
    expect(cyclesAt(raw)).toEqual([]);
    const top = foldEdges(raw, (id) => visibleAncestor(id, tree, 0));
    expect(cyclesAt(top.edges).map((c) => [...c].sort())).toEqual([['catalog', 'pay']]);
  });
});

describe('подсказки дробления', () => {
  const many = (n: number): TreeNode[] => [
    { id: 'g' },
    ...Array.from({ length: n }, (_, i) => ({ id: `c${i}`, parent: 'g' }))
  ];

  it('больше девяти детей — да, ровно девять — нет', () => {
    expect(splitHints('g', many(10), [])).toContain('too_many_children');
    expect(splitHints('g', many(9), [])).not.toContain('too_many_children');
  });

  it('единственный ребёнок — подсказка; ноль и два — нет', () => {
    expect(splitHints('g', many(1), [])).toContain('single_child');
    expect(splitHints('g', many(0), [])).not.toContain('single_child');
    expect(splitHints('g', many(2), [])).not.toContain('single_child');
  });

  it('связей наружу больше, чем внутри; поровну — нет', () => {
    const nodes = many(2);
    const out: Edge[] = [{ from: 'c0', to: 'z' }, { from: 'c1', to: 'z' }, { from: 'c0', to: 'c1' }];
    expect(splitHints('g', nodes, out)).toContain('more_outside_than_inside');
    expect(splitHints('g', nodes, [{ from: 'c0', to: 'z' }, { from: 'c0', to: 'c1' }])).not.toContain('more_outside_than_inside');
  });

  it('здоровая группа — без подсказок', () => {
    expect(splitHints('g', many(3), [{ from: 'c0', to: 'c1' }])).toEqual([]);
  });

  it('тексты: русские, с подстановкой; неизвестный код пропускается', () => {
    const texts = splitHintTexts(['too_many_children', 'single_child', 'more_outside_than_inside', 'cycle', 'нечто'], {
      title: 'Оплата', children: 12, inside: 1, outside: 4, cycle: ['A', 'B']
    });
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain('«Оплата»');
    expect(texts[0]).toContain('12');
    expect(texts[2]).toContain('внутри 1, наружу 4');
    expect(texts[3]).toContain('A → B');
    expect(splitHintTexts([])).toEqual([]);
  });
});
