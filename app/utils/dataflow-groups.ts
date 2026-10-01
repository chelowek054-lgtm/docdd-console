import { OTHER_GROUP, worstVerdict, type GroupModel } from '../../server/lib/groups';
import type { DataflowPart } from '../../server/lib/maps';
import { countWord } from './group-mermaid';
import {
  EMPTY, SOURCE_KIND_LABEL, label, neighborsOf, nodeId,
  type BucketCard, type GroupCard, type MermaidEdge, type MermaidNode, type MermaidOutput
} from './map-mermaid';

/**
 * Потоки данных по тем же группам, что и кодовая карта (docs/07-maps.md,
 * «Группы: уровень над модулями»): код берётся из групп кодовой карты, а
 * источники сворачиваются по `kind` или по своему `group`. Обзор отвечает
 * «кто читает и пишет где»; внутри группы или свёртки остаётся нынешняя
 * детализация (`dataflowMermaid`).
 */

type Source = NonNullable<DataflowPart['sources']>[number];
type Flow = NonNullable<DataflowPart['flows']>[number];
export type DataflowShape = { sources: Source[]; flows: Flow[] };

const LF = String.fromCharCode(10);

/** Название свёртки источника: свой `group`, иначе вид источника словами. */
export function bucketOf(source: Pick<Source, 'kind' | 'group'>): string {
  return source.group ?? SOURCE_KIND_LABEL[source.kind] ?? source.kind;
}

export interface Bucket {
  id: string;
  sources: Source[];
  /** Источников нет в карте, а потоки к ним идут: они свёрнуты под собственным именем. */
  implicit: boolean;
}

/**
 * Свёртки источников. Поток к источнику, которого карта не объявила, получает
 * свёртку со своим именем: потеряться стрелка не должна (так же, как
 * `dataflowMermaid` рисует такой источник машинным id, но подписывает).
 */
export function bucketsOf(data: DataflowShape): Bucket[] {
  const buckets = new Map<string, Bucket>();
  const declared = new Set(data.sources.map((source) => source.id));
  for (const source of data.sources) {
    const id = bucketOf(source);
    const bucket = buckets.get(id) ?? { id, sources: [], implicit: false };
    bucket.sources.push(source);
    buckets.set(id, bucket);
  }
  for (const flow of data.flows) {
    if (declared.has(flow.to) || buckets.has(flow.to)) continue;
    buckets.set(flow.to, { id: flow.to, sources: [], implicit: true });
  }
  return [...buckets.values()].sort((a, b) => b.sources.length - a.sources.length || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * Группа кода, из которой идёт поток: `from` потока, совпавший с `id` или
 * `path` модуля, относится к его группе, остальные — к `Прочее`.
 */
export function flowGroupResolver(
  model: GroupModel,
  modules: readonly { id: string; path?: string }[]
): (flow: Pick<Flow, 'from'>) => string {
  const byKey = new Map<string, string>();
  for (const module of modules) {
    const group = model.groupOf.get(module.id);
    if (!group) continue;
    byKey.set(module.id, group);
    if (module.path) byKey.set(module.path, group);
  }
  return (flow) => model.groupOf.get(flow.from) ?? byKey.get(flow.from) ?? OTHER_GROUP;
}

/** Какой срез потоков показать внутри: группа кода или свёртка источников. */
export interface FlowScope {
  group?: string | null;
  bucket?: string | null;
}

/** Нынешняя детализация, суженная до группы или свёртки: те же источники и потоки, только нужные. */
export function scopeDataflow(
  data: DataflowShape,
  scope: FlowScope,
  groupOfFlow: (flow: Flow) => string
): DataflowShape {
  if (scope.group) {
    const flows = data.flows.filter((flow) => groupOfFlow(flow) === scope.group);
    const targets = new Set(flows.map((flow) => flow.to));
    return { sources: data.sources.filter((source) => targets.has(source.id)), flows };
  }
  if (scope.bucket) {
    const sources = data.sources.filter((source) => bucketOf(source) === scope.bucket);
    const ids = new Set(sources.map((source) => source.id));
    // Поток к источнику без объявления тоже попадает в свою свёртку.
    const flows = data.flows.filter((flow) => ids.has(flow.to) || (flow.to === scope.bucket && !data.sources.some((source) => source.id === flow.to)));
    return { sources, flows };
  }
  return data;
}

/** Направление в `flows` — строка схемы; незнакомое слово остаётся как есть, а не теряется. */
const VERB: Record<string, string> = { read: 'читает', write: 'пишет', both: 'читает и пишет' };
const verbOf = (direction: string) => VERB[direction] ?? direction;

export interface FlowOverviewContext {
  titleOf: (groupId: string) => string;
  cardOf: (groupId: string) => GroupCard | undefined;
}

/**
 * Обзор потоков: узлы — группы кода и свёртки источников, стрелки — свёрнутые
 * потоки с числом и глаголом. Чтение идёт от свёртки к группе (данные текут
 * туда, где их читают), запись — от группы к свёртке; «оба» — жирная стрелка.
 */
export function dataflowOverviewMermaid(
  data: DataflowShape,
  groupOfFlow: (flow: Flow) => string,
  context: FlowOverviewContext
): MermaidOutput {
  if (data.flows.length === 0 && data.sources.length === 0) return EMPTY;

  const buckets = bucketsOf(data);
  const bucketById = new Map(buckets.map((bucket) => [bucket.id, bucket]));
  const sourceBucket = new Map(data.sources.map((source) => [source.id, bucketOf(source)]));

  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];
  lines.push('    classDef grp fill:#EEF2FF,stroke:#6366F1,color:#111827;');
  lines.push('    classDef bucket fill:#ECFDF5,stroke:#059669,color:#111827;');

  const perGroup = new Map<string, Flow[]>();
  for (const flow of data.flows) {
    const group = groupOfFlow(flow);
    perGroup.set(group, [...(perGroup.get(group) ?? []), flow]);
  }
  const perBucket = new Map<string, number>();
  for (const flow of data.flows) {
    const id = sourceBucket.get(flow.to) ?? flow.to;
    perBucket.set(id, (perBucket.get(id) ?? 0) + 1);
  }

  for (const [group, list] of [...perGroup].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))) {
    const node = nodeId('g', group);
    const count = countWord(list.length, 'поток', 'потока', 'потоков');
    lines.push(`    ${node}["${label(context.titleOf(group), 30)}<br/>${count}"]:::grp`);
    details[node] = [group, context.titleOf(group), count].join(LF);
    nodes[node] = { id: group, title: context.titleOf(group), group: context.cardOf(group) };
  }

  for (const bucket of buckets) {
    const node = nodeId('b', bucket.id);
    const count = bucket.implicit
      ? 'источник не объявлен'
      : countWord(bucket.sources.length, 'источник', 'источника', 'источников');
    // Хранилища (база, файлы) — цилиндром, остальное — прямоугольником, как и в детализации.
    const stores = bucket.sources.length > 0 && bucket.sources.every((source) => source.kind === 'db' || source.kind === 'file');
    const text = `${label(bucket.id, 30)}<br/>${count}`;
    lines.push(`    ${node}${stores ? `[("${text}")]` : `["${text}"]`}:::bucket`);
    details[node] = [bucket.id, count].join(LF);
    nodes[node] = {
      id: bucket.id,
      title: bucket.id,
      bucket: {
        id: bucket.id,
        title: bucket.id,
        flows: perBucket.get(bucket.id) ?? 0,
        sources: bucket.sources.map((source) => ({ id: source.id, title: source.title, kind: source.kind, where: source.where }))
      } satisfies BucketCard
    };
  }

  // Стрелка на пару «группа — свёртка — направление»: сколько бы потоков за ней ни стояло.
  const folded = new Map<string, { group: string; bucket: string; direction: Flow['direction']; flows: Flow[] }>();
  for (const flow of data.flows) {
    const group = groupOfFlow(flow);
    const bucket = sourceBucket.get(flow.to) ?? flow.to;
    const key = `${group}|${bucket}|${flow.direction}`;
    const entry = folded.get(key) ?? { group, bucket, direction: flow.direction, flows: [] };
    entry.flows.push(flow);
    folded.set(key, entry);
  }

  const edges: MermaidEdge[] = [];
  for (const entry of folded.values()) {
    if (!bucketById.has(entry.bucket)) continue;
    const group = nodeId('g', entry.group);
    const bucket = nodeId('b', entry.bucket);
    const [from, to] = entry.direction === 'read' ? [bucket, group] : [group, bucket];
    const arrow = entry.direction === 'both' ? '==>' : entry.direction === 'write' ? '-.->' : '-->';
    const text = `${verbOf(entry.direction)} · ${entry.flows.length}`;
    lines.push(`    ${from} ${arrow}|${text}| ${to}`);
    const status = worstVerdict(entry.flows.map((flow) => flow.status));
    edges.push({
      from, to, status, pending: status === 'pending' || undefined,
      groupLink: {
        fromGroup: entry.direction === 'read' ? entry.bucket : entry.group,
        toGroup: entry.direction === 'read' ? entry.group : entry.bucket,
        fromTitle: entry.direction === 'read' ? entry.bucket : context.titleOf(entry.group),
        toTitle: entry.direction === 'read' ? context.titleOf(entry.group) : entry.bucket,
        count: entry.flows.length,
        status,
        cycle: false,
        summary: verbOf(entry.direction),
        unit: 'flows',
        imports: entry.flows.map((flow) => ({ from: flow.from, to: flow.to, evidence: flow.evidence, status: flow.status }))
      }
    });
  }

  edges.forEach((edge, index) => {
    if (edge.status && edge.status !== 'ok' && edge.status !== 'pending') {
      lines.push(`    linkStyle ${index} stroke:#DC2626,stroke-width:2px;`);
    }
  });
  return { text: lines.join(LF), details, paths: {}, nodes, edges, neighbors: neighborsOf(edges) };
}
