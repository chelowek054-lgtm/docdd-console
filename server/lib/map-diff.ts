import { ancestors, visibleAncestor, type TreeNode } from './hierarchy';
import { approvedMaps, foldMaps, parseMapRecord, type MapChange, type MapStructure, type ProjectMap } from './maps';
import type { WorkRecord } from './types';

/**
 * Разница карты на самой схеме (R-0069, docs/04-ui.md). «Было» — сложенная
 * картина подтверждённых карт до этой записи, «станет» — она же вместе с ней.
 * Чистые функции: файлов и сети здесь нет, экран получает готовую разметку.
 */

export type DiffMark = 'added' | 'removed' | 'changed' | 'same';

export interface DiffNode {
  /** Ключ в пределах структуры; у пользовательских карт — `карта:id`. */
  key: string;
  id: string;
  title: string;
  parent?: string | undefined;
  mark: DiffMark;
  /** Какие поля изменились (у `changed`): название, слой, группа, родитель, состояние… */
  fields: string[];
}

export interface DiffEdge {
  key: string;
  from: string;
  to: string;
  label: string;
  mark: DiffMark;
}

export interface StructureDiff {
  structure: MapStructure;
  nodes: DiffNode[];
  edges: DiffEdge[];
}

export interface DiffCounts { added: number; removed: number; changed: number; edgesAdded: number; edgesRemoved: number; edgesChanged: number }

export interface MapDiff {
  recordId: string;
  structures: StructureDiff[];
}

/** Поля, которые не про смысл узла: след складывания и результат сверки. */
const NOISE = new Set(['declaredBy', 'declaredAt', 'declaredByRole', 'pending', 'status_verdict', 'evidence', 'map']);

/* eslint-disable @typescript-eslint/no-explicit-any -- элементы разных структур сравниваются одинаково, по полям */
interface Spec { nodes: string[]; edges: string[]; nodeKey: (item: any) => string; edgeKey: (item: any) => string; edgeLabel: (item: any) => string }

const pairKey = (item: any) => `${item.from}>${item.to}`;
const SPECS: Record<MapStructure, Spec> = {
  codemap: { nodes: ['modules', 'groups'], edges: ['imports'], nodeKey: (i) => i.id, edgeKey: pairKey, edgeLabel: () => 'import' },
  dataflow: { nodes: ['sources'], edges: ['flows'], nodeKey: (i) => i.id, edgeKey: pairKey, edgeLabel: (i) => i.direction ?? '' },
  userflow: { nodes: ['screens'], edges: ['transitions', 'calls'], nodeKey: (i) => i.id, edgeKey: pairKey, edgeLabel: (i) => i.trigger ?? '' },
  functional: { nodes: ['capabilities'], edges: ['relations'], nodeKey: (i) => i.id, edgeKey: (i) => `${pairKey(i)}:${i.type}`, edgeLabel: (i) => i.type ?? '' },
  custom: { nodes: ['nodes'], edges: ['relations'], nodeKey: (i) => `${i.map}:${i.id}`, edgeKey: (i) => `${i.map}:${pairKey(i)}:${i.type}`, edgeLabel: (i) => i.type ?? '' }
};

/** Группа модуля — не поле модуля, а список в группе; для сравнения достраиваем её как поле. */
function withGroupOf(map: ProjectMap): Map<string, string> {
  const of = new Map<string, string>();
  for (const group of map.codemap.groups) for (const id of group.modules ?? []) of.set(id, group.id);
  return of;
}

function changedFields(before: any, after: any): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  return [...keys].filter((key) => !NOISE.has(key) && JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)).sort();
}

function diffStructure(structure: MapStructure, before: ProjectMap, after: ProjectMap): StructureDiff {
  const spec = SPECS[structure];
  const groupBefore = withGroupOf(before);
  const groupAfter = withGroupOf(after);
  const items = (map: ProjectMap, fields: string[], groups: Map<string, string>) =>
    fields.flatMap((field) => ((map as any)[structure][field] as any[]).map((item) => (
      structure === 'codemap' && field === 'modules' ? { ...item, group: groups.get(item.id) } : item)));

  const nodes: DiffNode[] = [];
  const was = new Map(items(before, spec.nodes, groupBefore).map((item) => [spec.nodeKey(item), item]));
  const now = new Map(items(after, spec.nodes, groupAfter).map((item) => [spec.nodeKey(item), item]));
  const nodeOf = (item: any, mark: DiffMark, fields: string[] = []): DiffNode => ({
    key: spec.nodeKey(item), id: item.id, title: item.title ?? item.id, parent: item.parent ?? item.group, mark, fields
  });
  for (const [key, item] of now) {
    const old = was.get(key);
    if (!old) nodes.push(nodeOf(item, 'added'));
    else {
      const fields = changedFields(old, item);
      nodes.push(nodeOf(item, fields.length > 0 ? 'changed' : 'same', fields));
    }
  }
  for (const [key, item] of was) if (!now.has(key)) nodes.push(nodeOf(item, 'removed'));

  const edges: DiffEdge[] = [];
  const oldEdges = new Map(items(before, spec.edges, groupBefore).map((item) => [spec.edgeKey(item), item]));
  const newEdges = new Map(items(after, spec.edges, groupAfter).map((item) => [spec.edgeKey(item), item]));
  const edgeOf = (item: any, mark: DiffMark): DiffEdge => ({ key: spec.edgeKey(item), from: item.from, to: item.to, label: spec.edgeLabel(item), mark });
  for (const [key, item] of newEdges) {
    const old = oldEdges.get(key);
    edges.push(edgeOf(item, !old ? 'added' : changedFields(old, item).length > 0 ? 'changed' : 'same'));
  }
  for (const [key, item] of oldEdges) if (!newEdges.has(key)) edges.push(edgeOf(item, 'removed'));

  return { structure, nodes, edges };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Две картины: подтверждённые карты до записи и они же вместе с ней. */
export function pictures(records: readonly WorkRecord[], recordId: string, change: MapChange): { before: ProjectMap; after: ProjectMap } {
  const approved = approvedMaps(records);
  // Подтверждённая запись смотрится «на момент до себя»: берём только предшествующие ей.
  const at = approved.findIndex((record) => record.id === recordId);
  const earlier = (at === -1 ? approved : approved.slice(0, at))
    .map((record) => ({ id: record.id, change: parseMapRecord(record.body).change }));
  return { before: foldMaps(earlier), after: foldMaps([...earlier, { id: recordId, change }]) };
}

export function mapDiff(before: ProjectMap, after: ProjectMap, recordId = ''): MapDiff {
  const structures = (Object.keys(SPECS) as MapStructure[]).map((structure) => diffStructure(structure, before, after))
    // Структура, которой запись не коснулась, на экране лишняя.
    .filter((item) => item.nodes.some((node) => node.mark !== 'same') || item.edges.some((edge) => edge.mark !== 'same'));
  return { recordId, structures };
}

/** Разница карты, записанной в `records` под номером `recordId`. */
export function mapDiffForRecord(records: readonly WorkRecord[], recordId: string): MapDiff | null {
  const record = records.find((item) => item.id === recordId);
  if (!record || record.type !== 'map') return null;
  const { before, after } = pictures(records, recordId, parseMapRecord(record.body).change);
  return mapDiff(before, after, recordId);
}

/** Счётчик «+N, −N, ~N; +N связей». */
export function diffCounts(diff: StructureDiff): DiffCounts {
  const count = <T extends { mark: DiffMark }>(list: readonly T[], mark: DiffMark) => list.filter((item) => item.mark === mark).length;
  return {
    added: count(diff.nodes, 'added'), removed: count(diff.nodes, 'removed'), changed: count(diff.nodes, 'changed'),
    edgesAdded: count(diff.edges, 'added'), edgesRemoved: count(diff.edges, 'removed'), edgesChanged: count(diff.edges, 'changed')
  };
}

export function countsText(counts: DiffCounts): string {
  const edges = [counts.edgesAdded && `+${counts.edgesAdded}`, counts.edgesRemoved && `−${counts.edgesRemoved}`, counts.edgesChanged && `~${counts.edgesChanged}`].filter(Boolean).join(' ');
  return `+${counts.added}, −${counts.removed}, ~${counts.changed}${edges ? `; связей ${edges}` : ''}`;
}

function treeOf(diff: StructureDiff): TreeNode[] {
  const ids = new Set(diff.nodes.map((node) => node.id));
  // Родитель, которого нет среди узлов, делает узел корнем — как в hierarchy.ts.
  return diff.nodes.map((node) => ({ id: node.id, parent: node.parent && ids.has(node.parent) ? node.parent : undefined }));
}

/** Сколько изменённых узлов лежит под каждой группой на любой глубине (подсветка свёрнутых групп). */
export function changedInside(diff: StructureDiff): Map<string, number> {
  const tree = treeOf(diff);
  const inside = new Map<string, number>();
  for (const node of diff.nodes) {
    if (node.mark === 'same') continue;
    for (const up of ancestors(node.id, tree)) inside.set(up, (inside.get(up) ?? 0) + 1);
  }
  return inside;
}

/** «Только изменённое с соседями»: изменённые узлы, их предки (чтобы дерево не рвалось) и концы изменённых связей. */
export function onlyChangedIds(diff: StructureDiff): Set<string> {
  const tree = treeOf(diff);
  const keep = new Set<string>();
  const add = (id: string) => {
    keep.add(id);
    for (const up of ancestors(id, tree)) keep.add(up);
  };
  const changed = new Set(diff.nodes.filter((node) => node.mark !== 'same').map((node) => node.id));
  for (const id of changed) add(id);
  for (const edge of diff.edges) {
    if (edge.mark !== 'same') {
      add(edge.from);
      add(edge.to);
    } else if (changed.has(edge.from) || changed.has(edge.to)) {
      // Сосед изменённого узла по неизменной связи: виден, чтобы было понятно, куда вписано.
      add(edge.from);
      add(edge.to);
    }
  }
  return keep;
}

export interface LevelNode { id: string; title: string; mark: DiffMark; inside: number }
export interface LevelEdge { from: string; to: string; mark: DiffMark; count: number }

/**
 * Картина на глубине `level` (ADR-0027): узлы глубже сворачиваются в видимого
 * предка, и такой предок подсвечен как изменённый, если что-то изменилось под ним.
 * Стрелка между видимыми узлами — добавленная/убранная, только если все связи под ней такие.
 */
export function atLevel(diff: StructureDiff, level: number): { nodes: LevelNode[]; edges: LevelEdge[] } {
  const tree = treeOf(diff);
  const inside = changedInside(diff);
  const shown = new Set(diff.nodes.map((node) => visibleAncestor(node.id, tree, level)));
  const nodes: LevelNode[] = diff.nodes
    .filter((node) => shown.has(node.id))
    .map((node) => {
      const below = inside.get(node.id) ?? 0;
      return { id: node.id, title: node.title, mark: node.mark === 'same' && below > 0 ? 'changed' : node.mark, inside: below };
    });
  const folded = new Map<string, DiffEdge[]>();
  for (const edge of diff.edges) {
    const from = visibleAncestor(edge.from, tree, level);
    const to = visibleAncestor(edge.to, tree, level);
    if (from === to) continue; // внутренняя связь группы стрелкой не рисуется
    const key = `${from}\u0000${to}`;
    folded.set(key, [...(folded.get(key) ?? []), edge]);
  }
  const edges: LevelEdge[] = [...folded].map(([key, members]) => {
    const [from = '', to = ''] = key.split('\u0000');
    const marks = new Set(members.map((member) => member.mark));
    const only = marks.size === 1 ? [...marks][0] : undefined;
    return { from, to, mark: only ?? 'changed', count: members.length };
  });
  return { nodes, edges };
}
