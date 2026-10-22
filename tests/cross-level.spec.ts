// Сквозные связи через уровни (R-0089, docs/07-maps.md).
import { describe, expect, it } from 'vitest';

import { crossLevelRelations, crossLinksOf, type CapabilityLike } from '../server/lib/functional';

const caps: CapabilityLike[] = [
  { id: 'a' }, { id: 'a.b', parent: 'a' }, { id: 'a.b.c', parent: 'a.b' },
  { id: 'x' }, { id: 'x.y', parent: 'x' }
];

describe('сквозные связи', () => {
  it('родитель–ребёнок — не сквозная (это дерево)', () => {
    expect(crossLevelRelations(caps, [{ from: 'a.b', to: 'a', type: 'uses' }])).toEqual([]);
  });
  it('разные ветки и глубины — сквозная, с числом уровней', () => {
    const found = crossLevelRelations(caps, [{ from: 'a.b.c', to: 'x', type: 'depends' }]);
    expect(found).toEqual([{ from: 'a.b.c', to: 'x', type: 'depends', gap: 2 }]);
  });
  it('одна глубина в разных ветках — не сквозная', () => {
    expect(crossLevelRelations(caps, [{ from: 'a.b', to: 'x.y', type: 'uses' }])).toEqual([]);
  });
  it('связь с несуществующим узлом пропускается; выбор узла отбирает свои', () => {
    const all = crossLevelRelations(caps, [{ from: 'a.b.c', to: 'x', type: 'depends' }, { from: 'a', to: 'ghost', type: 'uses' }]);
    expect(all).toHaveLength(1);
    expect(crossLinksOf('x', all)).toHaveLength(1);
    expect(crossLinksOf('a', all)).toHaveLength(0);
  });
});
