import { describe, expect, it } from 'vitest';
import { domainGraph } from '../app/utils/domain-graph';
import { flowGraph } from '../app/utils/map-flow';
import { emptyDomain } from '../server/lib/domain-map';
import { standardFor } from '../server/lib/map-core';
import { MAP_SHAPES } from '../app/utils/map-shapes';

describe('граф доменной карты', () => {
  it('у понятия, события и закона три разных контура по стандарту', () => {
    const kinds = standardFor('domain')!.standard.nodeKinds.filter((kind) => ['concept', 'event', 'rule'].includes(kind.id));
    expect(new Set(kinds.map((kind) => MAP_SHAPES[kind.shape])).size).toBe(3);
  });
  it('сохраняет направление, тип и пояснение обеих связей цепочки', () => {
    const graph = domainGraph({
      ...emptyDomain(),
      nodes: [
        { id: 'paid', title: 'Оплата', kind: 'event', summary: 'Получены деньги' },
        { id: 'access', title: 'Право доступа', kind: 'rule', summary: 'Действует после оплаты' },
        { id: 'download', title: 'Загрузка', kind: 'concept', summary: 'Получение файла' }
      ],
      edges: [
        { from: 'paid', to: 'access', type: 'causes' },
        { from: 'access', to: 'download', type: 'constrains', summary: 'До конца подписки' }
      ]
    });
    const drawn = flowGraph(graph.nodes, graph.edges, standardFor('domain')!.standard, 'dark');
    expect(drawn.edges).toMatchObject([
      { source: 'node:paid', target: 'node:access', label: 'вызывает', markerEnd: 'arrow', style: { strokeDasharray: '6 4' } },
      { source: 'node:access', target: 'node:download', label: 'ограничивает · До конца подписки', markerEnd: 'arrowclosed', style: { strokeDasharray: '2 3' } }
    ]);
  });

  it('сохраняет исходный тип связи двух DDD-контекстов и разделяет совпадающие id контекста и агрегата', () => {
    const graph = domainGraph({ ...emptyDomain(), contexts: [{ id: 'shop' }, { id: 'ledger' }],
      aggregates: [{ id: 'shop', context: 'shop' }], relations: [{ from: 'shop', to: 'ledger', kind: 'published-language' }]
    });
    expect(graph.nodes.map((node) => node.id)).toEqual(['context:shop', 'context:ledger', 'aggregate:shop']);
    expect(graph.edges).toMatchObject([
      { from: 'context:shop', to: 'aggregate:shop', type: 'owns' },
      { from: 'context:shop', to: 'context:ledger', type: 'published-language', summary: 'published-language' }
    ]);
  });
});
