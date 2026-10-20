import { describe, expect, it } from 'vitest';

import { groupModules } from '../server/lib/groups';
import { rootOf } from '../server/lib/functional';
import { cyclesAt, splitHints, splitHintTexts, type Edge, type TreeNode } from '../server/lib/hierarchy';

/** R-0040 / ADR-0027 п.6: подсказки дробления; п.3: topOf/rootOf на ancestors. */
const kids = (parent: string, n: number): TreeNode[] => Array.from({ length: n }, (_, i) => ({ id: `${parent}.${i}`, parent }));

describe('подсказки дробления', () => {
  it('больше девяти детей — too_many_children; ровно девять — нет', () => {
    expect(splitHints('g', [{ id: 'g' }, ...kids('g', 10)], [])).toContain('too_many_children');
    expect(splitHints('g', [{ id: 'g' }, ...kids('g', 9)], [])).not.toContain('too_many_children');
  });

  it('единственный ребёнок — single_child', () => {
    expect(splitHints('g', [{ id: 'g' }, ...kids('g', 1)], [])).toContain('single_child');
    expect(splitHints('g', [{ id: 'g' }, ...kids('g', 2)], [])).not.toContain('single_child');
  });

  it('связей наружу больше, чем внутри — more_outside_than_inside; поровну — нет', () => {
    const nodes: TreeNode[] = [{ id: 'g' }, { id: 'a', parent: 'g' }, { id: 'b', parent: 'g' }, { id: 'x' }, { id: 'y' }];
    const out: Edge[] = [{ from: 'a', to: 'x' }, { from: 'y', to: 'b' }, { from: 'a', to: 'b' }];
    expect(splitHints('g', nodes, out)).toContain('more_outside_than_inside');
    expect(splitHints('g', nodes, out.slice(1))).not.toContain('more_outside_than_inside');
  });

  it('неизвестная группа и пустые данные не дают подсказок и не падают', () => {
    expect(splitHints('нет', [], [])).toEqual([]);
  });

  it('тексты: русские, неизвестный код пропускается', () => {
    const texts = splitHintTexts(['too_many_children', 'single_child', 'more_outside_than_inside', 'cycle', 'чужой'], { title: 'Оплата', children: 12, inside: 1, outside: 4, cycle: ['a', 'b'] });
    expect(texts).toHaveLength(4);
    expect(texts[0]).toContain('12');
    expect(texts[2]).toContain('внутри 1, наружу 4');
    expect(texts[3]).toContain('a → b');
    expect(splitHintTexts([])).toEqual([]);
  });

  it('цикл между соседями находит компоненты больше одного узла, петли не считает', () => {
    expect(cyclesAt([{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }, { from: 'c', to: 'c' }, { from: 'c', to: 'a' }]).map((r) => [...r].sort())).toEqual([['a', 'b']]);
    expect(cyclesAt([])).toEqual([]);
  });
});

describe('topOf (через groupModules) и rootOf остались прежними', () => {
  const mods = [{ id: 'm1', path: 'a/m1.ts' }, { id: 'm2', path: 'b/m2.ts' }];
  it('подгруппа сжимается до верхней объявленной группы', () => {
    const g = groupModules(mods, [], [
      { id: 'top' }, { id: 'mid', parent: 'top' }, { id: 'low', parent: 'mid', modules: ['m1'] }
    ]);
    expect(g.groupOf('m1')).toBe('top');
  });

  it('родитель-призрак: группа считается верхней', () => {
    const g = groupModules(mods, [], [{ id: 'low', parent: 'нет', modules: ['m1'] }]);
    expect(g.groupOf('m1')).toBe('low');
  });

  it('цикл parent не роняет расчёт, модуль остаётся в одной из групп цикла', () => {
    const g = groupModules(mods, [], [
      { id: 'p', parent: 'q', modules: ['m1'] }, { id: 'q', parent: 'p' }
    ]);
    expect(['p', 'q']).toContain(g.groupOf('m1'));
  });

  it('rootOf: цепочка, сирота, цикл', () => {
    const caps = [{ id: 'a' }, { id: 'b', parent: 'a' }, { id: 'c', parent: 'b' }, { id: 'o', parent: 'нет' }];
    expect(rootOf('c', caps)).toBe('a');
    expect(rootOf('o', caps)).toBe('o');
    expect(['x', 'y']).toContain(rootOf('x', [{ id: 'x', parent: 'y' }, { id: 'y', parent: 'x' }]));
  });
});
