import { LINK_KINDS, type LinkKind, type WorkRecord } from './types';

export interface Edge {
  kind: LinkKind;
  from: string;
  to: string;
}

export interface Graph {
  byId: ReadonlyMap<string, WorkRecord>;
  /** Связи как они записаны в `links`. */
  out: ReadonlyMap<string, readonly Edge[]>;
  /** Обратные связи: в файлах их нет, их строит приложение. */
  in: ReadonlyMap<string, readonly Edge[]>;
  /** Идентификаторы, встреченные больше одного раза. */
  duplicates: readonly string[];
}

/**
 * Первая запись с данным идентификатором попадает в `byId`, остальные считаются
 * дублями: выбирать «правильную» из двух приложение не вправе, а показать обе
 * как нарушение обязано.
 */
export function buildGraph(records: readonly WorkRecord[]): Graph {
  const byId = new Map<string, WorkRecord>();
  const duplicates: string[] = [];

  for (const record of records) {
    if (!record.id) continue;
    if (byId.has(record.id)) {
      if (!duplicates.includes(record.id)) duplicates.push(record.id);
      continue;
    }
    byId.set(record.id, record);
  }

  const out = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();

  for (const record of records) {
    if (!record.id) continue;
    for (const kind of LINK_KINDS) {
      for (const to of record.links[kind] ?? []) {
        const edge: Edge = { kind, from: record.id, to };
        push(out, record.id, edge);
        push(incoming, to, edge);
      }
    }
  }

  return { byId, out, in: incoming, duplicates };
}

export function outgoing(graph: Graph, id: string, kind?: LinkKind): readonly Edge[] {
  const edges = graph.out.get(id) ?? [];
  return kind ? edges.filter((edge) => edge.kind === kind) : edges;
}

export function incomingEdges(graph: Graph, id: string, kind?: LinkKind): readonly Edge[] {
  const edges = graph.in.get(id) ?? [];
  return kind ? edges.filter((edge) => edge.kind === kind) : edges;
}

/**
 * Циклы в `depends_on`. Возвращается сам цикл, а не только факт: сообщение
 * «T-0001 → T-0002 → T-0001» показывает, какую связь снимать.
 */
export function findDependencyCycles(graph: Graph): string[][] {
  const cycles: string[][] = [];
  const seen = new Set<string>();
  const known = new Set<string>();

  const walk = (id: string, path: string[]): void => {
    const position = path.indexOf(id);
    if (position !== -1) {
      const cycle = path.slice(position);
      const key = canonical(cycle);
      if (!known.has(key)) {
        known.add(key);
        cycles.push(cycle);
      }
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    for (const edge of outgoing(graph, id, 'depends_on')) {
      // Ссылка в никуда — это link_broken, а не цикл.
      if (!graph.byId.has(edge.to)) continue;
      walk(edge.to, [...path, id]);
    }
  };

  for (const id of [...graph.byId.keys()].sort()) {
    walk(id, []);
  }
  return cycles;
}

/** Один и тот же цикл находится с разных входов — сводим к общему виду. */
function canonical(cycle: readonly string[]): string {
  const smallest = [...cycle].sort()[0];
  const start = cycle.indexOf(smallest as string);
  return [...cycle.slice(start), ...cycle.slice(0, start)].join('>');
}

function push(map: Map<string, Edge[]>, key: string, edge: Edge): void {
  const list = map.get(key);
  if (list) list.push(edge);
  else map.set(key, [edge]);
}
