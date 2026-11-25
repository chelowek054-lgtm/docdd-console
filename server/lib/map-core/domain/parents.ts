import type { LintFinding } from './lint';

type Node = { id: string; parent?: string | undefined };
type Link = { from: string; to: string };

export function isolatedMapNodes(nodes: readonly Node[], links: readonly Link[]): Set<string> {
  const ids = new Set(nodes.map((node) => node.id));
  const connected = new Set<string>();
  const connect = (from: string, to: string) => {
    if (from === to || !ids.has(from) || !ids.has(to)) return;
    connected.add(from);
    connected.add(to);
  };
  for (const node of nodes) if (node.parent) connect(node.id, node.parent);
  for (const link of links) connect(link.from, link.to);
  return new Set([...ids].filter((id) => !connected.has(id)));
}

export function lintMapParents(added: readonly Node[], removed: readonly Node[], existing: readonly Node[]): LintFinding[] {
  const byId = new Map(existing.map((node) => [node.id, node]));
  for (const node of removed) byId.delete(node.id);
  for (const node of added) byId.set(node.id, node);
  const affected = new Set([...added.map((node) => node.id), ...removed.map((node) => node.id)]);
  const found: LintFinding[] = [];
  for (const node of byId.values()) {
    if (!affected.has(node.id) && !(node.parent && affected.has(node.parent))) continue;
    const seen = new Set([node.id]);
    for (let id = node.parent; id; id = byId.get(id)?.parent) {
      if (seen.has(id) || !byId.has(id)) {
        found.push({
          severity: 'error', code: 'map_lint_field', target: node.id, field: 'parent',
          message: seen.has(id) ? `Цикл родителей у узла «${node.id}»` : `Родитель «${id}» отсутствует в карте`
        });
        break;
      }
      seen.add(id);
    }
  }
  return found;
}
