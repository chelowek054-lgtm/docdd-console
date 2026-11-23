import { lintGraph, type LintFinding, type LintNode } from '../domain/lint';
import type { MapStandard } from '../domain/standard';

/** Форма возможности и связи стратегической карты — без зависимости от разбора карт. */
interface CapabilityIn { id: string; kind?: string | undefined; title?: string | undefined; summary?: string | undefined; parent?: string | undefined }
interface RelationIn { from: string; to: string; type: string; summary?: string | undefined }

export interface StrategicChange {
  added?: { capabilities?: readonly CapabilityIn[]; relations?: readonly RelationIn[] } | undefined;
}

/**
 * Линтер записи стратегической карты (R-0141, R-0147). Узел записи складывается с прежним состоянием
 * той же возможности: отметка состояния несёт только `id` и `status`, имя и назначение у неё уже есть.
 */
export function lintStrategicChange(
  change: StrategicChange | undefined,
  existing: { capabilities: readonly CapabilityIn[] },
  standard: MapStandard,
  text?: string
): LintFinding[] {
  if (!change?.added) return [];
  const known = new Map<string, LintNode>(existing.capabilities.map((item) => [item.id, toNode(item)]));
  const nodes = (change.added.capabilities ?? []).map((item) => {
    const before = known.get(item.id);
    const after = toNode(item);
    return {
      id: item.id,
      kind: after.kind ?? before?.kind,
      title: after.title ?? before?.title,
      summary: after.summary ?? before?.summary,
      parent: after.parent ?? before?.parent
    };
  });
  const edges = (change.added.relations ?? []).map((item) => ({ from: item.from, to: item.to, kind: item.type, label: item.summary }));
  return lintGraph({ nodes, edges, known, ...(text ? { text } : {}) }, standard);
}

function toNode(item: CapabilityIn): LintNode {
  return { id: item.id, kind: item.kind, title: item.title, summary: item.summary, parent: item.parent };
}

export function lintDomainChange(
  change: { added?: { nodes?: CapabilityIn[]; edges?: RelationIn[] }; removed?: { nodes?: { id: string }[]; edges?: RelationIn[] } },
  existing: { nodes?: CapabilityIn[]; edges?: RelationIn[] },
  standard: MapStandard,
  text?: string
): LintFinding[] {
  const removed = new Set(change.removed?.nodes?.map((node) => node.id));
  const key = (edge: RelationIn) => JSON.stringify([edge.from, edge.to, edge.type]);
  const removedEdges = new Set(change.removed?.edges?.map(key));
  const affected = (existing.edges ?? []).filter((edge) =>
    (removed.has(edge.from) || removed.has(edge.to)) && !removedEdges.has(key(edge)));
  return lintStrategicChange({
    added: { capabilities: change.added?.nodes, relations: [...affected, ...(change.added?.edges ?? [])] }
  }, { capabilities: (existing.nodes ?? []).filter((item) => !removed.has(item.id)) }, standard, text);
}
