import { blockText, tokenColor, type MapStandard } from '../../server/lib/map-core';

/**
 * Редактор карты (R-0144, A-0010 п. 8): из узлов и связей стратегической карты — узлы и рёбра холста
 * Vue Flow по стандарту обозначений, из правок мышью — блок записи карты. Чистые функции: холст и
 * сервер их только вызывают, проверяются они без браузера.
 */

export interface FlowCapability { id: string; title?: string; summary?: string; parent?: string; kind?: string; status?: string }
export interface FlowRelation {
  from: string; to: string; type: string; summary?: string; filterType?: string; count?: number;
}

export interface FlowNodeData {
  title: string;
  summary: string;
  kind: string;
  kindTitle: string;
  icon: string;
  color: string;
  fresh: boolean;
}

export interface FlowNode { id: string; type: 'map'; position: { x: number; y: number }; data: FlowNodeData }
export interface FlowEdge {
  id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string;
  style?: Record<string, string | number>; markerEnd?: string; markerStart?: string; class?: string;
  data: { kind: string; fresh: boolean; structural: boolean };
}

export const NODE_WIDTH = 240;
export const NODE_HEIGHT = 84;
const DASH: Record<string, string | undefined> = { solid: undefined, dashed: '6 4', dotted: '2 3' };

/** Узел холста: вид — из записи или вид стандарта по умолчанию, цвет — токен вида по теме. */
export function flowNode(item: FlowCapability, standard: MapStandard, theme: 'light' | 'dark', fresh = false): FlowNode {
  const kindId = item.kind ?? standard.defaultNodeKind ?? standard.nodeKinds[0]?.id ?? 'node';
  const kind = standard.nodeKinds.find((entry) => entry.id === kindId);
  return {
    id: item.id,
    type: 'map',
    position: { x: 0, y: 0 },
    data: {
      title: item.title ?? item.id,
      summary: item.summary ?? '',
      kind: kindId,
      kindTitle: kind?.title ?? kindId,
      icon: kind?.icon ?? 'i-lucide-circle',
      color: tokenColor(kind?.color ?? '', theme) ?? 'currentColor',
      fresh
    }
  };
}

/** Ребро холста по виду связи: линия, наконечник, «туда-обратно»; подпись — из записи. */
export function flowEdge(item: FlowRelation, standard: MapStandard, fresh = false): FlowEdge {
  const kind = standard.edgeKinds.find((entry) => entry.id === item.type);
  const dash = DASH[kind?.line ?? 'solid'];
  const marker = kind?.head === 'none' ? undefined : kind?.head === 'open' ? 'arrow' : 'arrowclosed';
  return {
    id: `${item.from}>${item.to}:${item.type}`,
    source: item.from,
    target: item.to,
    sourceHandle: 'out',
    targetHandle: 'in',
    ...(item.summary ? { label: item.summary } : kind ? { label: kind.title } : {}),
    style: { strokeWidth: 1.5, ...(dash ? { strokeDasharray: dash } : {}) },
    ...(marker ? { markerEnd: marker } : {}),
    ...(kind?.twoWay && marker ? { markerStart: marker } : {}),
    ...(fresh ? { class: 'map-flow-fresh' } : {}),
    data: { kind: item.type, fresh, structural: false }
  };
}

/** Вложенность — тонкий штрих от родителя: часть картины, но не связь, которую правят. */
export function parentEdge(child: string, parent: string): FlowEdge {
  return {
    id: `parent:${parent}>${child}`,
    source: parent,
    target: child,
    sourceHandle: 'out',
    targetHandle: 'in',
    style: { strokeWidth: 1, strokeDasharray: '2 4', opacity: 0.5 },
    data: { kind: 'parent', fresh: false, structural: true }
  };
}

export function flowGraph(
  capabilities: readonly FlowCapability[],
  relations: readonly FlowRelation[],
  standard: MapStandard,
  theme: 'light' | 'dark'
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  const ids = new Set(capabilities.map((item) => item.id));
  return {
    nodes: capabilities.map((item) => flowNode(item, standard, theme)),
    edges: [
      ...capabilities.filter((item) => item.parent && ids.has(item.parent)).map((item) => parentEdge(item.id, item.parent as string)),
      ...relations.filter((item) => ids.has(item.from) && ids.has(item.to)).map((item) => flowEdge(item, standard))
    ]
  };
}

interface ElkLike {
  layout(graph: unknown): Promise<{ children?: { id: string; x?: number; y?: number }[] }>;
}

/** Раскладка слоями слева направо (elkjs): позиции узлов; связи рисует холст сам кривыми Безье. */
export async function layoutWithElk(elk: ElkLike, nodes: readonly FlowNode[], edges: readonly Pick<FlowEdge, 'id' | 'source' | 'target'>[], layerGap = 72): Promise<FlowNode[]> {
  const graph = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.spacing.nodeNode': '32',
      'elk.layered.spacing.nodeNodeBetweenLayers': String(layerGap)
    },
    children: nodes.map((node) => ({ id: node.id, width: NODE_WIDTH, height: NODE_HEIGHT })),
    edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] }))
  };
  const placed = await elk.layout(graph);
  const at = new Map((placed.children ?? []).map((child) => [child.id, { x: child.x ?? 0, y: child.y ?? 0 }]));
  return nodes.map((node) => ({ ...node, position: at.get(node.id) ?? node.position }));
}

/** Правка мышью — блок записи стратегической карты: новое и изменённое в `added`, убранное в `removed`. */
export function editorDraft(
  nodes: readonly FlowCapability[],
  relations: readonly FlowRelation[],
  removedNodes: readonly string[] = [],
  removedRelations: readonly FlowRelation[] = []
): string {
  return blockText(
    { kind: 'strategic' },
    { nodes: nodes.map((node) => ({ ...node })), edges: relations.map((edge) => ({ ...edge })) },
    { nodes: removedNodes.map((id) => ({ id })), edges: removedRelations.map((edge) => ({ from: edge.from, to: edge.to, type: edge.type })) }
  );
}

/** id нового узла из имени: латиница, цифры, точки и дефисы; занятый — с номером. */
export function suggestId(title: string, taken: ReadonlySet<string>, parent?: string): string {
  const MAP: Record<string, string> = { а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya' };
  const slug = [...title.toLowerCase()].map((char) => MAP[char] ?? char).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'node';
  const base = parent ? `${parent}.${slug}` : slug;
  if (!taken.has(base)) return base;
  let number = 2;
  while (taken.has(`${base}-${number}`)) number += 1;
  return `${base}-${number}`;
}
