import { worstVerdict, type Group, type GroupModel } from '../../server/lib/groups';
import { layerOf } from '../../server/lib/layers';
import type { CodemapPart } from '../../server/lib/maps';
import {
  EMPTY, classDefs, label, neighborsOf, nodeId,
  type EdgeGroupLink, type GroupCard, type MermaidEdge, type MermaidNode, type MermaidOutput
} from './map-mermaid';

/**
 * Три уровня кодовой карты (docs/04-ui.md, «Группы кодовой карты»): обзор
 * групп, одна группа целиком и выбранный модуль с соседями из других групп.
 * Отдельно от `map-mermaid.ts`: там один вид карты — одна диаграмма, а здесь
 * один вид показывается тремя разными, и общий у них только набор помощников.
 */

type Mod = NonNullable<CodemapPart['modules']>[number];
export type GroupImportRecord = NonNullable<CodemapPart['imports']>[number];
export type GroupedCodemap = { modules: Mod[]; imports: GroupImportRecord[] };
export type CodemapGroups = GroupModel<GroupImportRecord>;

const LF = String.fromCharCode(10);

/**
 * «2 модуля», «5 модулей». Своя, а не `plural` из labels.ts: этот модуль читает
 * тест без Nuxt, а labels.ts тянет алиас Nuxt (`~~`), которого обычный tsc не знает.
 */
export function countWord(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

/** Больше стольких соседей из других групп призраками не рисуются — сворачиваются в узлы-группы. */
export const MAX_GHOSTS = 12;

const BAD = new Set(['stale', 'missing', 'still_present']);

function titleOfGroup(model: CodemapGroups, id: string): string {
  return model.groups.find((group) => group.id === id)?.title ?? id;
}

/** Названия возможностей функциональной карты — для строки «реализует возможность» в карточке группы. */
export type CapabilityTitles = ReadonlyMap<string, { title?: string }>;

/** Карточка группы: что в ней, что она отдаёт наружу и с кем связана. */
export function groupCardOf(
  model: CodemapGroups,
  group: Group,
  modules: ReadonlyMap<string, Mod>,
  capabilities?: CapabilityTitles
): GroupCard {
  const links: GroupCard['links'] = [];
  for (const link of model.links) {
    if (link.from === group.id) {
      links.push({ direction: 'out', other: link.to, otherTitle: titleOfGroup(model, link.to), count: link.count, status: link.status, cycle: link.cycle });
    } else if (link.to === group.id) {
      links.push({ direction: 'in', other: link.from, otherTitle: titleOfGroup(model, link.from), count: link.count, status: link.status, cycle: link.cycle });
    }
  }
  return {
    id: group.id,
    title: group.title,
    auto: group.auto,
    summary: group.summary,
    modules: group.modules.length,
    sources: group.sources,
    capability: group.capability ? { id: group.capability, title: capabilities?.get(group.capability)?.title } : undefined,
    surface: (model.surface.get(group.id) ?? []).map((id) => ({ id, title: modules.get(id)?.title })),
    links
  };
}

function edgeLinkOf(
  model: CodemapGroups,
  fromGroup: string,
  toGroup: string,
  imports: readonly GroupImportRecord[],
  cycle: boolean,
  summary?: string
): EdgeGroupLink {
  return {
    fromGroup,
    toGroup,
    fromTitle: titleOfGroup(model, fromGroup),
    toTitle: titleOfGroup(model, toGroup),
    count: imports.length,
    status: worstVerdict(imports.map((item) => item.status)),
    cycle,
    summary,
    imports: imports.map((item) => ({ from: item.from, to: item.to, evidence: item.evidence, status: item.status }))
  };
}

/** Расходящееся со сверкой красим на самой стрелке; `pending` — не расхождение, а «ещё не запускали». */
function styleBad(lines: string[], edges: readonly MermaidEdge[], cycleAt: ReadonlySet<number> = new Set()): void {
  edges.forEach((edge, index) => {
    if (edge.status && BAD.has(edge.status)) lines.push(`    linkStyle ${index} stroke:#DC2626,stroke-width:2px;`);
    else if (cycleAt.has(index)) lines.push(`    linkStyle ${index} stroke:#EA580C,stroke-width:3px;`);
  });
}

// --- 1. Обзор: узлы — группы, стрелки — свёрнутые связи ---

/** Размер узла растёт с числом модулей: mermaid размеров не знает, поэтому растёт шрифт и рамка. */
const SIZES = [
  { font: 12, width: 1 },
  { font: 14, width: 2 },
  { font: 17, width: 3 },
  { font: 20, width: 4 }
] as const;

function sizeBucket(count: number, max: number): number {
  const ratio = max === 0 ? 0 : count / max;
  return ratio > 0.7 ? 3 : ratio > 0.4 ? 2 : ratio > 0.15 ? 1 : 0;
}

export function groupsOverviewMermaid(
  model: CodemapGroups,
  modules: ReadonlyMap<string, Mod>,
  capabilities?: CapabilityTitles
): MermaidOutput {
  if (model.groups.length === 0) return EMPTY;

  const max = Math.max(...model.groups.map((group) => group.modules.length));
  const lines = ['flowchart LR'];
  SIZES.forEach((size, index) => {
    lines.push(`    classDef gsize_${index} fill:#EEF2FF,stroke:#6366F1,stroke-width:${size.width}px,font-size:${size.font}px,color:#111827;`);
  });
  lines.push('    classDef gcycle stroke:#EA580C,stroke-dasharray:4 2;');

  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  for (const group of model.groups) {
    const node = nodeId('g', group.id);
    const count = countWord(group.modules.length, 'модуль', 'модуля', 'модулей');
    lines.push(`    ${node}["${label(group.title, 30)}<br/>${count}${group.auto ? ' · авто' : ''}"]:::gsize_${sizeBucket(group.modules.length, max)}`);
    details[node] = [group.id, group.title, count, group.auto ? 'автогруппа — посчитана по пути' : ''].filter(Boolean).join(LF);
    nodes[node] = { id: group.id, title: group.title, group: groupCardOf(model, group, modules, capabilities) };
  }

  const edges: MermaidEdge[] = [];
  const cycleAt = new Set<number>();
  const inCycle = new Set<string>();
  for (const link of model.links) {
    const from = nodeId('g', link.from);
    const to = nodeId('g', link.to);
    // Подпись на стрелке — понятная фраза, если она есть, иначе число импортов.
    const text = link.summary
      ? label(link.summary.replace(/\|/g, '/'), 28)
      : countWord(link.count, 'импорт', 'импорта', 'импортов');
    lines.push(`    ${from} ${link.status === 'pending' ? '-.->' : '-->'}|${text}| ${to}`);
    if (link.cycle) {
      cycleAt.add(edges.length);
      inCycle.add(from).add(to);
    }
    edges.push({
      from, to, status: link.status, pending: link.status === 'pending' || undefined,
      groupLink: edgeLinkOf(model, link.from, link.to, link.imports, link.cycle, link.summary)
    });
  }

  if (inCycle.size > 0) lines.push(`    class ${[...inCycle].join(',')} gcycle;`);
  styleBad(lines, edges, cycleAt);
  return { text: lines.join(LF), details, paths: {}, nodes, edges, neighbors: neighborsOf(edges) };
}

// --- 2–3. Группа целиком и выбранный модуль ---

export interface GroupViewOptions {
  /** Слои, спрятанные чипами: внутри группы они работают так же, как на всей карте. */
  hiddenLayers?: ReadonlySet<string>;
  /** Выбранный модуль: его соседи из других групп показываются призраками. */
  focus?: string | null;
  /** Названия возможностей — для карточек соседних групп. */
  capabilities?: CapabilityTitles;
}

/**
 * Группа целиком, как кодовая карта сегодня, плюс то, что выходит за её
 * границу. Порты (модули с внешней связью) обведены толстой рамкой; внешние
 * связи без выделения модуля свёрнуты в узлы-группы по краям; у выбранного
 * модуля соседи из других групп показаны призраками — пунктир, лёгкая
 * прозрачность и подпись «из группы X». Призраки только у выбранного: у всех
 * разом они вернули бы ту же стену линий.
 */
export function groupMermaid(
  codemap: GroupedCodemap,
  model: CodemapGroups,
  groupId: string,
  options: GroupViewOptions = {}
): MermaidOutput {
  const group = model.groups.find((item) => item.id === groupId);
  if (!group) return EMPTY;

  const byId = new Map(codemap.modules.map((module) => [module.id, module]));
  const hidden = options.hiddenLayers ?? new Set<string>();
  // Модуль, названный только в импорте, слоя в карте не имеет — слой берётся по папке файла.
  const layerFor = (id: string) => layerOf(byId.get(id) ?? { id });
  const members = group.modules.filter((id) => !hidden.has(layerFor(id)));
  if (members.length === 0) return EMPTY;
  const memberSet = new Set(members);

  const details: Record<string, string> = {};
  const paths: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];

  const layers = new Map<string, string[]>();
  for (const id of members) layers.set(layerFor(id), [...(layers.get(layerFor(id)) ?? []), id]);
  lines.push(...classDefs(new Set(layers.keys()), 'layer'));
  lines.push('    classDef port stroke-width:4px;');
  lines.push('    classDef focus stroke:#2563EB,stroke-width:4px;');
  lines.push('    classDef ext fill:#F9FAFB,stroke:#6366F1,stroke-dasharray:2 2,color:#111827;');
  // Прозрачность призрака — 0.65, а не 0.5 и без пунктира у «карта не устоялась»:
  // два разных смысла не смешиваются одним приёмом (docs/04-ui.md).
  lines.push('    classDef ghost fill:#FFFFFF,stroke:#6B7280,stroke-dasharray:4 2,opacity:0.65,color:#111827;');

  const portIds: string[] = [];
  for (const [layer, ids] of layers) {
    lines.push(`    subgraph ${nodeId('layer', layer)}["${label(layer)}"]`);
    for (const id of ids) {
      const module = byId.get(id);
      const node = nodeId('m', id);
      lines.push(`        ${node}["${label(module?.title ?? id)}"]:::${nodeId('layer', layer)}`);
      details[node] = [id, module?.title, `слой: ${layer}`].filter(Boolean).join(LF);
      if (module?.path) paths[node] = module.path;
      const isPort = model.ports.has(id);
      if (isPort) portIds.push(node);
      nodes[node] = {
        id, title: module?.title, layer, path: module?.path, summary: module?.summary, api: module?.api,
        declaredBy: module?.declaredBy, pending: module?.pending, port: isPort || undefined
      };
    }
    lines.push('    end');
  }

  // Связи через границу: один конец в группе (виден), другой — в чужой.
  const focus = options.focus && memberSet.has(options.focus) ? options.focus : null;
  const cross: { member: string; other: string; outgoing: boolean; edge: GroupImportRecord }[] = [];
  for (const edge of codemap.imports) {
    const fromIn = memberSet.has(edge.from);
    const toIn = memberSet.has(edge.to);
    if (fromIn === toIn) continue;
    const member = fromIn ? edge.from : edge.to;
    const other = fromIn ? edge.to : edge.from;
    // Сосед из этой же группы, но со спрятанного слоя, — не «чужой», а просто скрытый.
    if (model.groupOf.get(other) === groupId) continue;
    cross.push({ member, other, outgoing: fromIn, edge });
  }

  const focused = focus === null ? [] : cross.filter((item) => item.member === focus);
  const ghosts = new Set(focused.map((item) => item.other));
  const useGhosts = ghosts.size > 0 && ghosts.size <= MAX_GHOSTS;
  // Слишком много соседей — они сворачиваются в узлы-группы вместе со всеми остальными.
  const collapsed = useGhosts ? cross.filter((item) => item.member !== focus) : cross;

  if (useGhosts) {
    for (const other of ghosts) {
      const module = byId.get(other);
      const node = nodeId('ghost', other);
      const ownGroup = titleOfGroup(model, model.groupOf.get(other) ?? '');
      lines.push(`    ${node}["${label(module?.title ?? other, 30)}<br/>из группы ${label(ownGroup, 24)}"]:::ghost`);
      details[node] = [other, module?.title, `из группы: ${ownGroup}`].filter(Boolean).join(LF);
      if (module?.path) paths[node] = module.path;
      nodes[node] = {
        id: other, title: module?.title, layer: layerFor(other), path: module?.path, summary: module?.summary,
        api: module?.api, declaredBy: module?.declaredBy, pending: module?.pending, ghostOf: ownGroup
      };
    }
  }

  const external = new Map<string, string>();
  const outside = (gid: string): string => {
    let node = external.get(gid);
    if (!node) {
      node = nodeId('x', gid);
      external.set(gid, node);
      const other = model.groups.find((item) => item.id === gid);
      const count = other ? countWord(other.modules.length, 'модуль', 'модуля', 'модулей') : '';
      lines.push(`    ${node}["${label(titleOfGroup(model, gid), 30)}${count ? `<br/>${count}` : ''}"]:::ext`);
      details[node] = [gid, titleOfGroup(model, gid), count].filter(Boolean).join(LF);
      if (other) nodes[node] = { id: gid, title: other.title, group: groupCardOf(model, other, byId, options.capabilities) };
    }
    return node;
  };

  const edges: MermaidEdge[] = [];
  for (const edge of codemap.imports) {
    if (!memberSet.has(edge.from) || !memberSet.has(edge.to)) continue;
    const from = nodeId('m', edge.from);
    const to = nodeId('m', edge.to);
    lines.push(`    ${from} --> ${to}`);
    edges.push({
      from, to, evidence: edge.evidence, status: edge.status, declaredBy: edge.declaredBy, pending: edge.pending
    });
  }

  if (useGhosts) {
    for (const item of focused) {
      const member = nodeId('m', item.member);
      const ghost = nodeId('ghost', item.other);
      const [from, to] = item.outgoing ? [member, ghost] : [ghost, member];
      lines.push(`    ${from} --> ${to}`);
      edges.push({
        from, to, evidence: item.edge.evidence, status: item.edge.status,
        declaredBy: item.edge.declaredBy, pending: item.edge.pending
      });
    }
  }

  // Свёртка: порт → чужая группа одной стрелкой, сколько бы импортов за ней ни стояло.
  const folded = new Map<string, { member: string; group: string; outgoing: boolean; imports: GroupImportRecord[] }>();
  for (const item of collapsed) {
    const other = model.groupOf.get(item.other) ?? '';
    const key = `${item.member}|${other}|${item.outgoing ? 'out' : 'in'}`;
    const entry = folded.get(key) ?? { member: item.member, group: other, outgoing: item.outgoing, imports: [] };
    entry.imports.push(item.edge);
    folded.set(key, entry);
  }
  for (const entry of folded.values()) {
    const member = nodeId('m', entry.member);
    const node = outside(entry.group);
    const [from, to] = entry.outgoing ? [member, node] : [node, member];
    const link = model.links.find((item) => (entry.outgoing
      ? item.from === groupId && item.to === entry.group
      : item.from === entry.group && item.to === groupId));
    const text = entry.imports.length > 1 ? `|${entry.imports.length}|` : '';
    lines.push(`    ${from} -->${text} ${to}`);
    const status = worstVerdict(entry.imports.map((item) => item.status));
    edges.push({
      from, to, status, pending: status === 'pending' || undefined,
      groupLink: edgeLinkOf(
        model,
        entry.outgoing ? groupId : entry.group,
        entry.outgoing ? entry.group : groupId,
        entry.imports,
        link?.cycle ?? false,
        link?.summary
      )
    });
  }

  if (portIds.length > 0) lines.push(`    class ${portIds.join(',')} port;`);
  if (focus !== null) lines.push(`    class ${nodeId('m', focus)} focus;`);
  styleBad(lines, edges);
  return { text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges) };
}
