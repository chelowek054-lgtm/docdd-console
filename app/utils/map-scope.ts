import type { FlowCapability, FlowRelation } from './map-flow';

export interface MapGroupInfo {
  children: number;
  incoming: number;
  outgoing: number;
}

export interface ScopedMapEdge extends FlowRelation {
  members: FlowRelation[];
}

export function mapScope(nodes: FlowCapability[], relations: FlowRelation[], open: string | undefined, depth = 1) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const paths = new Map<string, string[]>();
  for (const node of nodes) {
    if (paths.has(node.id)) continue;
    const trail: string[] = [];
    const seen = new Set<string>();
    let id: string | undefined = node.id;
    while (id && byId.has(id) && !paths.has(id) && !seen.has(id)) {
      trail.push(id);
      seen.add(id);
      id = byId.get(id)?.parent;
    }
    let path = id ? paths.get(id) ?? [] : [];
    for (const item of trail.reverse()) {
      path = [...path, item];
      paths.set(item, path);
    }
  }
  const path = open ? paths.get(open) ?? [] : [];
  const within = (id: string) => !open || paths.get(id)?.includes(open);
  const maxDepth = Math.max(1, ...nodes.filter((node) => within(node.id)).map((node) => (paths.get(node.id)?.length ?? 0) - path.length));
  const level = Math.min(maxDepth, Math.max(1, Math.floor(depth) || 1));
  const visible = (id: string) => {
    const parts = paths.get(id) ?? [];
    const divergence = parts.findIndex((part, index) => part !== path[index]);
    const index = within(id) ? path.length + level - 1 : Math.max(0, divergence);
    return parts[Math.min(index, parts.length - 1)] ?? id;
  };
  const visibleIds = new Set(nodes.filter((node) => node.id !== open && within(node.id)).map((node) => visible(node.id)));
  const expanded = new Set([...visibleIds].flatMap((id) => (paths.get(id) ?? []).slice(Math.max(0, path.length - 1), -1)));
  const outside = new Set<string>();
  const edges = new Map<string, ScopedMapEdge>();
  const groups = new Map<string, MapGroupInfo>();
  for (const node of nodes) {
    if (!node.parent || !byId.has(node.parent)) continue;
    const info = groups.get(node.parent) ?? { children: 0, incoming: 0, outgoing: 0 };
    ++info.children;
    groups.set(node.parent, info);
  }
  for (const relation of relations) {
    if (!byId.has(relation.from) || !byId.has(relation.to)) continue;
    const a = new Set(paths.get(relation.from));
    const b = new Set(paths.get(relation.to));
    for (const id of a) {
      const info = groups.get(id);
      if (info && !b.has(id)) ++info.outgoing;
    }
    for (const id of b) {
      const info = groups.get(id);
      if (info && !a.has(id)) ++info.incoming;
    }
    if (!within(relation.from) && !within(relation.to)) continue;
    const from = relation.from === open ? open : visible(relation.from);
    const to = relation.to === open ? open : visible(relation.to);
    if (from === to) continue;
    if (!within(relation.from)) outside.add(from);
    if (!within(relation.to)) outside.add(to);
    const key = JSON.stringify([from, to, relation.type]);
    const edge = edges.get(key) ?? { ...relation, from, to, members: [] };
    edge.members.push(relation);
    if (edge.members.length > 1) edge.summary = String(edge.members.length);
    edges.set(key, edge);
  }
  return {
    maxDepth,
    level,
    nodeDepths: new Map([...paths].map(([id, parts]) => [id, parts.length])),
    path: path.flatMap((id) => byId.get(id) ?? []),
    nodes: nodes.filter((node) => (visibleIds.has(node.id) && !expanded.has(node.id)) || outside.has(node.id)),
    edges: [...edges.values()],
    groups,
    outside
  };
}
