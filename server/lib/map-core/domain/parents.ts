import type { LintFinding } from './lint';

type Node = { id: string; parent?: string | undefined };

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
