import type { MapEdge, MapNode } from './map-block';

/**
 * Короткая форма стратегической карты маленького проекта (R-0147): «откуда, куда, зачем» — два узла и
 * связь `now → goal` вида «питает» с подписью «зачем». Узлы получают назначение из тех же слов, так что
 * запись проходит линтер без доописания.
 */
export interface ShortForm { from: string; to: string; why: string }

export function shortStrategicMap(form: ShortForm): { nodes: MapNode[]; edges: MapEdge[] } | null {
  const from = form.from.trim();
  const to = form.to.trim();
  const why = form.why.trim();
  if (!from || !to || !why) return null;
  return {
    nodes: [
      { id: 'now', title: from, summary: `Откуда начинаем: ${from}`, status: 'implemented' },
      { id: 'goal', title: to, summary: `Куда идём: ${why}`, status: 'not_implemented' }
    ],
    edges: [{ from: 'now', to: 'goal', type: 'feeds', summary: why }]
  };
}
