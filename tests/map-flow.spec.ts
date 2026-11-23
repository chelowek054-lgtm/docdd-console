// Редактор карты: узлы и рёбра по стандарту, раскладка elkjs, черновик из правок (R-0144).
import ELK from 'elkjs/lib/elk.bundled.js';
import { describe, expect, it } from 'vitest';

import { editorDraft, flowEdge, flowGraph, layoutWithElk, suggestId } from '../app/utils/map-flow';
import { parseMapRecord } from '../server/lib/maps';
import { standardFor } from '../server/lib/map-core';

const standard = standardFor('strategic')?.standard;
if (!standard) throw new Error('нет стандарта');

describe('редактор карты (V-0154, чистая часть)', () => {
  it('узел красится по виду стандарта; вид по умолчанию — возможность', () => {
    const graph = flowGraph([{ id: 'a', title: 'А', summary: 'Нужна' }, { id: 'p', title: 'Оплата', kind: 'external' }], [], standard, 'light');
    expect(graph.nodes[0]?.data).toMatchObject({ kind: 'capability', color: '#4338ca', title: 'А' });
    expect(graph.nodes[1]?.data).toMatchObject({ kind: 'external', color: '#4b5563', icon: 'i-lucide-cloud' });
  });

  it('связь рисуется по виду: штрих у feeds, открытая стрелка у triggers; вложенность — штрихом без правки', () => {
    expect(flowEdge({ from: 'a', to: 'b', type: 'feeds', summary: 'JSON' }, standard)).toMatchObject({ label: 'JSON', style: { strokeDasharray: '6 4' }, markerEnd: 'arrowclosed' });
    expect(flowEdge({ from: 'a', to: 'b', type: 'triggers' }, standard).markerEnd).toBe('arrow');
    const graph = flowGraph([{ id: 'a' }, { id: 'a.b', parent: 'a' }], [{ from: 'a.b', to: 'ghost', type: 'uses' }], standard, 'dark');
    expect(graph.edges.map((edge) => edge.id)).toEqual(['parent:a>a.b']);
  });

  it('elkjs раскладывает слоями слева направо', async () => {
    const graph = flowGraph([{ id: 'a' }, { id: 'b' }], [{ from: 'a', to: 'b', type: 'uses' }], standard, 'light');
    const placed = await layoutWithElk(new ELK(), graph.nodes, graph.edges);
    const [a, b] = placed;
    expect((b?.position.x ?? 0) > (a?.position.x ?? 0)).toBe(true);
  });

  it('правки мышью — один блок docdd-functional, который разбирает сервер', () => {
    const answer = editorDraft([{ id: 'n', title: 'Новый', summary: 'Нужен', status: 'not_implemented' }], [{ from: 'n', to: 'a', type: 'uses' }]);
    const parsed = parseMapRecord(answer);
    expect(parsed.problems).toEqual([]);
    expect(parsed.change.functional?.added?.capabilities?.[0]).toMatchObject({ id: 'n', title: 'Новый' });
    expect(parsed.change.functional?.added?.relations).toEqual([{ from: 'n', to: 'a', type: 'uses' }]);
  });

  it('id из имени: транслит, родитель через точку, занятый — с номером', () => {
    expect(suggestId('Корзина покупок', new Set())).toBe('korzina-pokupok');
    expect(suggestId('Оплата', new Set(['shop.oplata']), 'shop')).toBe('shop.oplata-2');
  });
});
