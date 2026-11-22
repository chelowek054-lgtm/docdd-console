import { lintGraph, type LintFinding, type LintNode } from '../domain/lint';
import type { MapStandard } from '../domain/standard';

/** Определение пользовательской карты в той мере, что нужна линтеру. */
export interface CustomDefinitionLike {
  id: string;
  title: string;
  node: { label: string };
  relations: readonly { id: string; label: string }[];
}

interface CustomNodeIn { map?: string | undefined; id: string; title?: string | undefined; summary?: string | undefined; parent?: string | undefined }
interface CustomRelationIn { map?: string | undefined; from: string; to: string; type: string; summary?: string | undefined }

export interface CustomChangeLike {
  map?: string | undefined;
  added?: { nodes?: readonly CustomNodeIn[] | undefined; relations?: readonly CustomRelationIn[] | undefined } | undefined;
}

/**
 * Стандарт пользовательской карты — из её определения (ADR-0028): виды связей объявил проект, вид узла
 * один. Подписи связей необязательны: определение их не требует, а линтер не вводит правил сверх него.
 */
export function customStandard(definition: CustomDefinitionLike): MapStandard {
  return {
    template: definition.id,
    title: definition.title,
    question: '',
    sources: [{ name: 'Определение карты в манифесте', note: 'виды связей и название узла' }],
    own: [],
    defaultNodeKind: 'node',
    nodeKinds: [{ id: 'node', title: definition.node.label, shape: 'rounded', color: 'map-capability', icon: 'i-lucide-circle', container: true }],
    edgeKinds: definition.relations.map((kind) => ({ id: kind.id, title: kind.label, line: 'solid', head: 'arrow', label: 'optional' }))
  };
}

/** Линтер записи пользовательских карт: элементы раскладываются по своим картам, у каждой — свой стандарт. */
export function lintCustomChange(
  change: CustomChangeLike | undefined,
  definitions: readonly CustomDefinitionLike[],
  existing: { nodes: readonly CustomNodeIn[] },
  text?: string
): LintFinding[] {
  if (!change?.added) return [];
  const mapOf = (item: { map?: string | undefined }) => item.map ?? change.map ?? '';
  const maps = new Set([...(change.added.nodes ?? []).map(mapOf), ...(change.added.relations ?? []).map(mapOf)]);
  const found: LintFinding[] = [];
  for (const mapId of maps) {
    const definition = definitions.find((item) => item.id === mapId);
    if (!definition) continue; // неизвестную карту называет разбор записи, не линтер
    const known = new Map<string, LintNode>(existing.nodes.filter((node) => node.map === mapId).map((node) => [node.id, { id: node.id, title: node.title, summary: node.summary, parent: node.parent }]));
    const nodes = (change.added.nodes ?? []).filter((node) => mapOf(node) === mapId).map((node) => {
      const before = known.get(node.id);
      return { id: node.id, title: node.title ?? before?.title, summary: node.summary ?? before?.summary, parent: node.parent ?? before?.parent };
    });
    const edges = (change.added.relations ?? []).filter((edge) => mapOf(edge) === mapId).map((edge) => ({ from: edge.from, to: edge.to, kind: edge.type, label: edge.summary }));
    found.push(...lintGraph({ nodes, edges, known, ...(text ? { text } : {}) }, customStandard(definition)));
  }
  return found;
}
