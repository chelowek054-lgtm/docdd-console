import {
  COVERAGE_LABEL,
  FUNCTIONAL_GHOST_LIMIT,
  IMPL_LABEL,
  childrenIndex,
  drawableRelations,
  filterLeaves,
  functionalGhosts,
  groupLevel,
  groupScopeOf,
  impactOf,
  isImplStatus,
  planPredicate,
  rootOf,
  type CapabilityCoverage,
  type PlanFilter,
  type StatusFilter
} from '../../server/lib/functional';
import {
  UNKNOWN_KIND,
  type FlowDirection,
  type FlowGhost,
  type FlowGrouping,
  type FlowItem
} from '../../server/lib/flow-groups';
import {
  groupCard,
  type GhostNode,
  type GroupCard,
  type GroupImport,
  type Grouping
} from '../../server/lib/groups';
// Слой по папке файла, когда карта его не назвала: docs/07-maps.md, «`layer` не обязателен».
import { layerOf } from '../../server/lib/layers';
import type { ApiItem, Evidence, EvidenceVerdict, ProjectMap } from '../../server/lib/maps';
import {
  RISK_LABEL,
  STATUS_STYLE,
  capabilityViews,
  planText,
  riskLevel,
  tasksText,
  type CapabilityView
} from './functional-view';

/**
 * Карты в текст mermaid. Тот же текст показывается на экране и выгружается,
 * чтобы вставить его в документ проекта и перерисовывать в его сборке
 * (docs/07-maps.md).
 *
 * Каждая функция отдаёт не только текст, но и что показать при наведении и
 * клике: `details` — полная подпись при наведении, `paths` — файл, который
 * открывает клик по узлу (`04-ui.md`, «Карты» — только если карта его
 * назвала, никогда не выдумывается по `id`), `nodes` — то же самое плюс
 * заголовок/слой/карта-источник структурой, для карточки при клике
 * (`MapInspector.vue`), `edges` — свидетельство и свежесть каждой связи
 * вместе с id её узлов (тех же, что в `details`), по которым экран
 * (`MermaidDiagram.vue`) ищет ребро в отрисованном SVG — mermaid кладёт оба
 * id в свой собственный id ребра, так же как в узле (см. `annotateTitles`),
 * и по ним же строится `neighbors` — для подсветки соседей узла при клике,
 * без похода в SVG вовсе.
 */

export interface MermaidEdge {
  /** id узлов — как в тексте диаграммы (`nodeId()` ниже), не исходные from/to карты. */
  from: string;
  to: string;
  evidence: Evidence;
  status?: EvidenceVerdict;
  /** Какая карта последней объявила эту связь (`server/lib/maps.ts`, `declaredBy`). */
  declaredBy?: string;
  /** Карта-источник ещё не устоялась — архитектор описал намерение, кода может не быть (`server/lib/maps.ts`). */
  pending?: boolean;
  /** Связь между группами: исходные импорты, свёрнутые в эту стрелку (`evidence` — первого из них). */
  link?: LinkCard;
}

/** Свёрнутая связь «группа → группа»: клик по стрелке на обзоре (docs/04-ui.md, «Группы кодовой карты»). */
export interface LinkCard {
  fromGroup: string;
  toGroup: string;
  fromTitle: string;
  toTitle: string;
  status: EvidenceVerdict;
  /** Группы зависят друг от друга по кругу. */
  cycle: boolean;
  /** Только у потоков данных: «читают» / «пишут» / «читают и пишут» — от лица группы кода. */
  direction?: FlowDirection;
  directionText?: string;
  imports: { from: string; to: string; evidence: Evidence; status?: EvidenceVerdict | undefined }[];
}

export interface MermaidNode {
  id: string;
  title?: string;
  layer?: string;
  path?: string;
  /** Что делает модуль — из карты (docs/07-maps.md). */
  summary?: string;
  /** Публичный интерфейс модуля — из карты. */
  api?: ApiItem[];
  declaredBy?: string;
  /** След правки курса — только у возможностей: когда карту подтвердили и кто (docs/07-maps.md). */
  declaredAt?: string | undefined;
  declaredByRole?: string | null | undefined;
  /** См. `MermaidEdge.pending` — то же самое, но у узла. */
  pending?: boolean;
  /** Возможность функциональной карты: у неё нет ни файла, ни интерфейса, только название и описание. */
  capability?: boolean;
  /** Что сделано и чего не хватает — `note` возможности. */
  note?: string | undefined;
  /** Состояние, связи и «ждёт» возможности (`app/utils/functional-view.ts`). */
  capabilityView?: CapabilityView;
  /** Возможность верхнего уровня, чью группу открывает двойной клик или «Открыть группу» в карточке. */
  capabilityGroup?: string;
  /** Узел обзора — группа: карточка группы для клика. */
  group?: GroupCard;
  /** «Призрак»: сосед выбранного модуля из другой группы (docs/04-ui.md, «Группы кодовой карты»). */
  ghost?: { groupId: string; groupTitle: string };
  /** Порт: у модуля есть связи за пределами его группы. */
  port?: boolean;
  /** Узел обзора потоков: группа кода или вид источников — двойной клик открывает его (docs/04-ui.md). */
  flowGroup?: { type: 'code' | 'kind'; id: string };
}

/** Что показывает `MapInspector.vue` — узел, ребро, группа или свёрнутая связь между группами. */
export type MapSelection =
  | ({ kind: 'node' } & MermaidNode)
  | ({ kind: 'edge' } & Pick<MermaidEdge, 'evidence' | 'status' | 'declaredBy'>)
  | ({ kind: 'group' } & GroupCard)
  | ({ kind: 'link' } & LinkCard);

/**
 * Легенда графа состояния данными, а не рамкой в тексте: экран рисует её полосой
 * над диаграммой, вне холста (docs/04-ui.md, «Легенда — над схемой»).
 */
export interface FunctionalLegend {
  entries: { key: string; label: string; count: number; fill: string; stroke: string; dash: boolean }[];
  kinds: { kind: string; text: string; count: number }[];
  hints: { waits: number; cycles: number };
}

export interface MermaidOutput {
  text: string;
  /** Только у графа состояния функциональной карты. */
  legend?: FunctionalLegend;
  /** Легенда остальных карт — полоса над схемой (`MapLegendBar.vue`). */
  mapLegend?: MapLegendItem[];
  /** id узла (как в тексте mermaid) → полный текст для title при наведении. */
  details: Record<string, string>;
  /** id узла → файл, который открывает клик. Узлов без объявленного файла тут нет. */
  paths: Record<string, string>;
  /** id узла → метаданные для карточки при клике (MapInspector.vue). */
  nodes: Record<string, MermaidNode>;
  /** Свидетельство и id узлов каждой связи — порядок совпадает с текстом диаграммы. */
  edges: MermaidEdge[];
  /** id узла → id узлов, с которыми он соединён связью (в любую сторону). */
  neighbors: Record<string, string[]>;
}

const LF = String.fromCharCode(10);
const EMPTY: MermaidOutput = { text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} };

/** `neighbors` — из уже собранных рёбер, один проход, обе стороны сразу. */
function neighborsOf(edges: readonly { from: string; to: string }[]): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => map.set(a, (map.get(a) ?? new Set()).add(b));
  for (const edge of edges) {
    link(edge.from, edge.to);
    link(edge.to, edge.from);
  }
  return Object.fromEntries([...map].map(([id, set]) => [id, [...set]]));
}

/** Идентификатор узла для mermaid: путь с точками и слешами он не переваривает. */
function nodeId(prefix: string, value: string): string {
  return `${prefix}_${value.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}`;
}

function label(text: string, limit = 40): string {
  const clean = text.replace(/["`]/g, "'");
  return clean.length > limit ? `${clean.slice(0, limit - 1)}…` : clean;
}

/**
 * Узел, который упомянут только в связи, mermaid покажет машинным
 * идентификатором. Объявляем такие сами: человек должен видеть путь, а не
 * `m_app_src_gone_ts`.
 */
function declareImplicit(
  lines: string[],
  details: Record<string, string>,
  prefix: string,
  declared: ReadonlySet<string>,
  used: readonly string[]
): void {
  for (const id of [...new Set(used)]) {
    if (declared.has(id)) continue;
    const node = nodeId(prefix, id);
    lines.push(`    ${node}["${label(id)}"]`);
    details[node] = id;
  }
}

/**
 * Цвет по категории — детерминированно, по имени: тот же слой или вид
 * источника всегда получает тот же цвет, между перерисовками и между
 * картами. Палитра подобрана так, чтобы текст поверх неё оставался чёрным
 * и читался без прищура (docs/04-ui.md).
 */
const PALETTE = [
  '#DBEAFE', '#DCFCE7', '#FEF3C7', '#FCE7F3', '#E0E7FF', '#FFEDD5', '#CCFBF1', '#F3E8FF'
];

/** Тот же цвет по слою/категории для 3D-режима (`MermaidDiagram3D.vue`) — одна палитра на оба вида. */
export function colorOf(key: string): string {
  let hash = 0;
  for (let at = 0; at < key.length; at += 1) hash = (hash * 31 + key.charCodeAt(at)) >>> 0;
  return PALETTE[hash % PALETTE.length] ?? '#E5E7EB';
}

/** `classDef`-блок: один класс на категорию, назначенный по цвету из палитры. */
function classDefs(categories: ReadonlySet<string>, prefix: string): string[] {
  return [...categories].map((category) => `    classDef ${nodeId(prefix, category)} fill:${colorOf(category)},stroke:#6B7280,color:#111827;`);
}

/**
 * `linkStyle` красит связь по её порядковому номеру в тексте диаграммы — тому
 * же номеру, что и позиция в массиве `edges` (см. заголовок файла). Красим
 * только то, что разошлось с кодом: не сошедшееся свидетельство важнее
 * увидеть на самой связи, а не только в списке нарушений (`docs/04-ui.md`).
 */
function styleUnverified(lines: string[], edges: readonly MermaidEdge[]): void {
  edges.forEach((edge, index) => {
    if (edge.status && edge.status !== 'ok') {
      lines.push(`    linkStyle ${index} stroke:#DC2626,stroke-width:2px;`);
    }
  });
}

/** Вид группы поверх обычной кодовой карты: порты и призраки выбранного модуля. */
export interface CodemapOptions {
  /** id модулей-портов — обведены толстой рамкой. */
  ports?: ReadonlySet<string>;
  /** Соседи выбранного модуля из других групп. */
  ghosts?: readonly GhostNode[];
  /** Связи выбранного модуля с призраками (концы уже переписаны на id призраков). */
  ghostImports?: readonly GroupImport[];
  /** Карточки групп — для свёрнутых призраков, у которых клик ведёт к группе. */
  ghostCards?: ReadonlyMap<string, GroupCard>;
}

/** id узла модуля — по нему экран находит узел в SVG и держит фокус на выбранном. */
export function moduleNodeId(moduleId: string): string {
  return nodeId('m', moduleId);
}

export function codemapMermaid(map: ProjectMap, options: CodemapOptions = {}): MermaidOutput {
  const { modules, imports } = map.codemap;
  if (modules.length === 0 && imports.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  const paths: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];
  // Слои становятся подграфами: колонка на слой читается лучше клубка.
  const layers = new Map<string, typeof modules>();
  for (const module of modules) {
    const layer = layerOf(module);
    layers.set(layer, [...(layers.get(layer) ?? []), module]);
  }

  lines.push(...classDefs(new Set(layers.keys()), 'layer'));

  for (const [layer, items] of layers) {
    lines.push(`    subgraph ${nodeId('layer', layer)}["${label(layer)}"]`);
    for (const module of items) {
      const node = nodeId('m', module.id);
      lines.push(`        ${node}["${label(module.title ?? module.id)}"]:::${nodeId('layer', layer)}`);
      details[node] = [module.id, module.title, `слой: ${layer}`].filter(Boolean).join(LF);
      if (module.path) paths[node] = module.path;
      nodes[node] = {
        id: module.id, title: module.title, layer, path: module.path,
        summary: module.summary, api: module.api, declaredBy: module.declaredBy, pending: module.pending,
        ...(options.ports?.has(module.id) ? { port: true } : {})
      };
    }
    lines.push('    end');
  }

  // Призраки — отдельной рамкой: они не часть открытой группы и не лежат в её слоях.
  const ghosts = options.ghosts ?? [];
  if (ghosts.length > 0) {
    lines.push('    classDef ghost fill:#F3F4F6,stroke:#6B7280,color:#111827,stroke-dasharray:5 4;');
    lines.push('    subgraph ghosts["Из других групп"]');
    for (const ghost of ghosts) {
      const node = nodeId('m', ghost.id);
      const name = ghost.collapsed ? `${ghost.groupTitle} · ${ghost.collapsed} модулей` : (ghost.title ?? ghost.id);
      lines.push(`        ${node}["${label(name)}<br/>из группы ${label(ghost.groupTitle, 28)}"]:::ghost`);
      details[node] = [ghost.id, ghost.title, `из группы ${ghost.groupTitle}`].filter(Boolean).join(LF);
      nodes[node] = {
        id: ghost.id, title: ghost.collapsed ? ghost.groupTitle : ghost.title,
        ghost: { groupId: ghost.groupId, groupTitle: ghost.groupTitle },
        ...(ghost.collapsed && options.ghostCards?.get(ghost.groupId) ? { group: options.ghostCards.get(ghost.groupId) as GroupCard } : {})
      };
    }
    lines.push('    end');
  }

  const ports = [...(options.ports ?? [])].filter((id) => modules.some((module) => module.id === id));
  if (ports.length > 0) {
    lines.push('    classDef port stroke-width:3px;');
    lines.push(`    class ${ports.map((id) => nodeId('m', id)).join(',')} port;`);
  }

  declareImplicit(
    lines,
    details,
    'm',
    new Set(modules.map((module) => module.id)),
    imports.flatMap((edge) => [edge.from, edge.to])
  );

  const edges: MermaidEdge[] = [];
  for (const edge of [...imports, ...(options.ghostImports ?? [])]) {
    const from = nodeId('m', edge.from);
    const to = nodeId('m', edge.to);
    lines.push(`    ${from} --> ${to}`);
    edges.push({
      from, to, evidence: edge.evidence, status: edge.status, declaredBy: edge.declaredBy, pending: edge.pending
    });
  }
  styleUnverified(lines, edges);
  return {
    text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges),
    mapLegend: codemapLegend(layers, ports.length, ghosts.length, edges)
  };
}

/**
 * Строка легенды вкладок «Кодовая база», «Потоки данных», «Пользовательские
 * пути» (docs/04-ui.md, «Легенда кодовой базы, потоков и путей»): полоса над
 * схемой, вне холста. Только то, что нарисовано, и с числом.
 */
export interface MapLegendItem {
  kind: 'swatch' | 'arrow' | 'note';
  label: string;
  count?: number;
  fill?: string;
  stroke?: string;
  /** Пунктирная рамка (сосед из другой группы, не опознанный вид). */
  dash?: boolean;
  /** Толстая рамка (порт). */
  thick?: boolean;
  /** Полупрозрачный: карта, что его объявила, ещё не устоялась. */
  faded?: boolean;
  shape?: 'box' | 'cylinder' | 'stadium';
  line?: 'solid' | 'dashed' | 'thick';
  color?: string;
}

const RED = '#DC2626';
const AMBER = '#D97706';
const NEUTRAL = { fill: '#F3F4F6', stroke: '#9CA3AF' };
const badEdge = (edge: { status?: EvidenceVerdict | undefined }) => !!edge.status && edge.status !== 'ok' && edge.status !== 'pending';

/** Строки, общие для всех трёх карт: не сошедшееся свидетельство и «ещё не устоялось». */
function commonLegend(pendingNodes: number, edges: readonly MermaidEdge[]): MapLegendItem[] {
  const items: MapLegendItem[] = [];
  const red = edges.filter(badEdge).length;
  if (red) items.push({ kind: 'arrow', label: 'свидетельство не сошлось с файлом', count: red, line: 'solid', color: RED });
  const faded = pendingNodes + edges.filter((edge) => edge.pending).length;
  if (faded) {
    items.push({ kind: 'swatch', label: 'полупрозрачный — карта, что его объявила, ещё не устоялась', count: faded, faded: true, ...NEUTRAL });
  }
  return items;
}

const present = (items: MapLegendItem[]) => items.filter((item) => item.kind === 'note' || (item.count ?? 0) > 0);

function groupOverviewLegend(
  groups: readonly { auto: boolean }[],
  links: readonly { cycle: boolean; status: EvidenceVerdict }[],
  edges: readonly MermaidEdge[]
): MapLegendItem[] {
  const autos = groups.filter((group) => group.auto).length;
  const cycles = links.filter((link) => link.cycle && !badEdge(link)).length;
  return present([
    { kind: 'swatch', label: 'группа; число внутри — модулей, цвет только отличает группы друг от друга', count: groups.length, fill: '#DBEAFE', stroke: '#6B7280' },
    { kind: 'note', label: '«авто» — группа выведена из путей к файлам, а не объявлена картой', count: autos },
    { kind: 'arrow', label: 'число на стрелке — сколько импортов идёт из группы в группу', count: links.length, line: 'solid' },
    { kind: 'arrow', label: 'группы зависят друг от друга по кругу', count: cycles, line: 'thick', color: AMBER },
    ...commonLegend(0, edges)
  ]);
}

/** Сколько слоёв называть поимённо: дальше легенда сама становится стеной. */
const LEGEND_LAYERS = 8;

function codemapLegend(
  layers: ReadonlyMap<string, readonly { pending?: boolean | undefined }[]>,
  ports: number,
  ghosts: number,
  edges: readonly MermaidEdge[]
): MapLegendItem[] {
  const named = [...layers].slice(0, LEGEND_LAYERS);
  const rest = layers.size - named.length;
  const modules = [...layers.values()].flat();
  return present([
    ...named.map(([layer, items]): MapLegendItem => ({
      kind: 'swatch', label: `слой «${layer}»`, count: items.length, fill: colorOf(layer), stroke: '#6B7280'
    })),
    { kind: 'note', label: `…и ещё ${rest} ${rest === 1 ? 'слой' : 'слоёв'}`, count: rest > 0 ? rest : 0 },
    { kind: 'swatch', label: 'толстая рамка — порт: у модуля есть связи за пределами группы', count: ports, thick: true, ...NEUTRAL },
    { kind: 'swatch', label: 'пунктир — сосед из другой группы', count: ghosts, dash: true, ...NEUTRAL },
    { kind: 'arrow', label: 'импорт: кто → кого', count: edges.filter((edge) => !badEdge(edge)).length, line: 'solid' },
    ...commonLegend(modules.filter((module) => module.pending).length, edges)
  ]).filter((item) => item.kind !== 'note' || (item.count ?? 0) > 0);
}

const directionLegend = (flows: readonly { direction: string }[]): MapLegendItem[] => [
  { kind: 'arrow', label: 'чтение: данные идут от источника', count: flows.filter((flow) => flow.direction === 'read').length, line: 'solid' },
  { kind: 'arrow', label: 'запись: данные идут к источнику', count: flows.filter((flow) => flow.direction === 'write').length, line: 'dashed' },
  { kind: 'arrow', label: 'и чтение, и запись', count: flows.filter((flow) => flow.direction === 'both').length, line: 'thick' }
];

function dataflowLegend(
  sources: readonly { kind: string; pending?: boolean | undefined }[],
  readers: number,
  ghosts: number,
  flows: readonly { direction: string }[],
  edges: readonly MermaidEdge[]
): MapLegendItem[] {
  const kinds = new Map<string, number>();
  for (const source of sources) kinds.set(source.kind, (kinds.get(source.kind) ?? 0) + 1);
  return present([
    ...[...kinds].map(([kind, count]): MapLegendItem => ({
      kind: 'swatch',
      label: SOURCE_KIND_LABEL[kind] ?? kind,
      count,
      fill: colorOf(kind),
      stroke: '#6B7280',
      shape: kind === 'db' || kind === 'file' ? 'cylinder' : 'box'
    })),
    { kind: 'swatch', label: 'модуль или экран, что читает и пишет', count: readers, fill: '#FFFFFF', stroke: '#6B7280' },
    { kind: 'swatch', label: 'пунктир — сосед из другой группы', count: ghosts, dash: true, ...NEUTRAL },
    ...directionLegend(flows),
    ...commonLegend(sources.filter((source) => source.pending).length, edges)
  ]);
}

function flowOverviewLegend(
  grouping: FlowGrouping,
  edges: readonly MermaidEdge[]
): MapLegendItem[] {
  return present([
    { kind: 'swatch', label: 'группа кода (слева); число внутри — потоков, цвет только отличает группы', count: grouping.codeGroups.length, fill: '#DBEAFE', stroke: '#6B7280' },
    ...grouping.kinds.map((item): MapLegendItem => ({
      kind: 'swatch',
      label: `вид источников: ${kindLabel(item.kind)}`,
      count: item.sources,
      fill: colorOf(item.kind),
      stroke: '#6B7280',
      shape: item.kind === 'db' || item.kind === 'file' ? 'cylinder' : 'box'
    })),
    ...directionLegend(grouping.links).map((item) => ({ ...item, label: `${item.label}; число — потоков` })),
    ...commonLegend(0, edges)
  ]);
}

function userflowLegend(
  screens: number,
  routes: number,
  transitions: readonly { trigger?: string | undefined }[],
  calls: number,
  edges: readonly MermaidEdge[],
  pendingScreens: number
): MapLegendItem[] {
  return present([
    { kind: 'swatch', label: 'экран', count: screens, fill: '#DBEAFE', stroke: '#2563EB' },
    { kind: 'swatch', label: 'маршрут API', count: routes, fill: '#F3E8FF', stroke: '#7C3AED', shape: 'stadium' },
    { kind: 'arrow', label: 'переход по действию; подпись — что его вызывает', count: transitions.filter((step) => step.trigger).length, line: 'solid' },
    { kind: 'arrow', label: 'пунктир к экрану — переход, чем он вызывается, карта не говорит', count: transitions.filter((step) => !step.trigger).length, line: 'dashed' },
    { kind: 'arrow', label: 'пунктир к маршруту — вызов API', count: calls, line: 'dashed' },
    ...commonLegend(pendingScreens, edges)
  ]);
}

const SOURCE_KIND_LABEL: Record<string, string> = {
  file: 'файл',
  http: 'http',
  db: 'база данных',
  queue: 'очередь',
  env: 'переменная окружения',
  memory: 'память процесса'
};

/** Вид группы потоков поверх обычной карты: кликабельные модули и призраки выбранного узла. */
export interface DataflowOptions {
  /** Узлы-«откуда» получают карточку (в группе кода — модуль, чей `id` обычно путь к файлу). */
  selectableFrom?: boolean;
  /** Чужие модули, трогающие тот же источник, что выбранный узел. */
  ghosts?: readonly FlowGhost[];
  /** Их потоки к источникам (концы уже переписаны на id призраков). */
  ghostFlows?: readonly FlowItem[];
  /** Карточки групп — для свёрнутых призраков. */
  ghostCards?: ReadonlyMap<string, GroupCard>;
}

/** id узла-«откуда» (модуль или экран) и узла источника — по ним экран держит фокус на выбранном. */
export function fromNodeId(id: string): string {
  return nodeId('f', id);
}
export function sourceNodeId(id: string): string {
  return nodeId('s', id);
}

export function dataflowMermaid(map: ProjectMap, options: DataflowOptions = {}): MermaidOutput {
  const { sources, flows } = map.dataflow;
  if (sources.length === 0 && flows.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  const paths: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];
  lines.push(...classDefs(new Set(sources.map((source) => source.kind)), 'kind'));

  for (const source of sources) {
    // Хранилище рисуется цилиндром, остальное — прямоугольником: вид источника
    // должен читаться без легенды. Цвет — тем же способом, по виду источника.
    const shape = source.kind === 'db' || source.kind === 'file'
      ? `[("${label(source.title ?? source.id)}")]`
      : `["${label(source.title ?? source.id)}"]`;
    const node = nodeId('s', source.id);
    lines.push(`    ${node}${shape}:::${nodeId('kind', source.kind)}`);
    details[node] = [
      source.id,
      source.title,
      `вид: ${SOURCE_KIND_LABEL[source.kind] ?? source.kind}`,
      source.where ? `где: ${source.where}` : ''
    ].filter(Boolean).join(LF);
    // Открыть можно только буквальный файл — адрес БД, очереди или имя
    // переменной окружения клик никуда не поведёт (04-ui.md, «Карты»).
    const filePath = source.kind === 'file' ? source.where : undefined;
    if (filePath) paths[node] = filePath;
    nodes[node] = {
      id: source.id,
      title: source.title,
      layer: SOURCE_KIND_LABEL[source.kind] ?? source.kind,
      path: filePath,
      declaredBy: source.declaredBy,
      pending: source.pending
    };
  }

  declareImplicit(lines, details, 's', new Set(sources.map((source) => source.id)), flows.map((flow) => flow.to));
  for (const name of [...new Set(flows.map((flow) => flow.from))]) {
    const node = nodeId('f', name);
    lines.push(`    ${node}["${label(name)}"]`);
    details[node] = name;
    if (options.selectableFrom) nodes[node] = { id: name, title: name };
  }

  // Призраки — отдельной рамкой: они не часть открытой группы (docs/04-ui.md, «Группы кодовой карты»).
  const ghosts = options.ghosts ?? [];
  if (ghosts.length > 0) {
    lines.push('    classDef ghost fill:#F3F4F6,stroke:#6B7280,color:#111827,stroke-dasharray:5 4;');
    lines.push('    subgraph ghosts["Из других групп"]');
    for (const ghost of ghosts) {
      const node = nodeId('f', ghost.id);
      const name = ghost.collapsed ? `${ghost.groupTitle} · ${ghost.collapsed} модулей` : ghost.id;
      lines.push(`        ${node}["${label(name)}<br/>из группы ${label(ghost.groupTitle, 28)}"]:::ghost`);
      details[node] = [ghost.id, `из группы ${ghost.groupTitle}`].join(LF);
      nodes[node] = {
        id: ghost.id, title: ghost.collapsed ? ghost.groupTitle : ghost.id,
        ghost: { groupId: ghost.groupId, groupTitle: ghost.groupTitle },
        ...(ghost.collapsed && options.ghostCards?.get(ghost.groupId) ? { group: options.ghostCards.get(ghost.groupId) as GroupCard } : {})
      };
    }
    lines.push('    end');
  }

  const edges: MermaidEdge[] = [];
  for (const flow of [...flows, ...(options.ghostFlows ?? [])]) {
    // Чтение — сплошная стрелка, запись — пунктир, «оба» — жирная сплошная:
    // направление данных видно по линии, не только по подписи.
    const arrow = flow.direction === 'both' ? '==>' : flow.direction === 'write' ? '-.->' : '-->';
    const from = flow.direction === 'read' ? nodeId('s', flow.to) : nodeId('f', flow.from);
    const to = flow.direction === 'read' ? nodeId('f', flow.from) : nodeId('s', flow.to);
    lines.push(`    ${from} ${arrow}|${flow.direction}| ${to}`);
    edges.push({
      from, to, evidence: flow.evidence, status: flow.status, declaredBy: flow.declaredBy, pending: flow.pending
    });
  }
  styleUnverified(lines, edges);
  return {
    text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges),
    mapLegend: dataflowLegend(
      sources,
      new Set(flows.map((flow) => flow.from)).size,
      ghosts.length,
      [...flows, ...(options.ghostFlows ?? [])],
      edges
    )
  };
}

const UNKNOWN_KIND_LABEL = 'не опознан';
const kindLabel = (kind: string) => (kind === UNKNOWN_KIND ? UNKNOWN_KIND_LABEL : SOURCE_KIND_LABEL[kind] ?? kind);

const DIRECTION_TEXT: Record<FlowDirection, string> = {
  read: 'читают',
  write: 'пишут',
  both: 'читают и пишут'
};

/**
 * Обзор потоков (docs/04-ui.md, «Группы кодовой карты»): группы кода и виды
 * источников со свёрнутыми потоками — кто читает и пишет где. Стрелка по
 * направлению данных, как у обычной диаграммы: чтение — от источника, запись —
 * к нему; подпись — число потоков. Расхождение хоть в одном потоке краснит
 * всю связь.
 */
export function flowOverviewMermaid(grouping: FlowGrouping, cards: ReadonlyMap<string, GroupCard>): MermaidOutput {
  if (grouping.links.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];
  lines.push(...classDefs(new Set(grouping.codeGroups.map((group) => group.id)), 'grp'));
  lines.push(...classDefs(new Set(grouping.kinds.map((item) => item.kind)), 'kind'));

  for (const group of grouping.codeGroups) {
    const node = nodeId('gf', group.id);
    const tail = `${group.flows} ${group.flows === 1 ? 'поток' : 'потоков'}`;
    lines.push(`    ${node}["${label(group.title, 34)}<br/>${tail}"]:::${nodeId('grp', group.id)}`);
    details[node] = [group.title, tail].join(LF);
    const card = cards.get(group.id);
    nodes[node] = {
      id: group.id, title: group.title, layer: group.title,
      flowGroup: { type: 'code', id: group.id }, ...(card ? { group: card } : {})
    };
  }

  for (const item of grouping.kinds) {
    // Хранилище — цилиндром, как на обычной диаграмме потоков.
    const node = nodeId('gk', item.kind);
    const text = `${label(kindLabel(item.kind))}<br/>${item.sources} ${item.sources === 1 ? 'источник' : 'источников'}`;
    const shape = item.kind === 'db' || item.kind === 'file' ? `[("${text}")]` : `["${text}"]`;
    lines.push(`    ${node}${shape}:::${nodeId('kind', item.kind)}`);
    details[node] = text.replace('<br/>', LF);
    nodes[node] = { id: item.kind, title: kindLabel(item.kind), layer: kindLabel(item.kind), flowGroup: { type: 'kind', id: item.kind } };
  }

  const edges: MermaidEdge[] = [];
  grouping.links.forEach((link, at) => {
    const code = nodeId('gf', link.codeGroup);
    const kind = nodeId('gk', link.kind);
    const arrow = link.direction === 'both' ? '==>' : link.direction === 'write' ? '-.->' : '-->';
    const from = link.direction === 'read' ? kind : code;
    const to = link.direction === 'read' ? code : kind;
    lines.push(`    ${from} ${arrow}|${link.flows.length}| ${to}`);
    const first = link.flows[0];
    if (!first) return;
    const titleOf = grouping.codeGroups.find((group) => group.id === link.codeGroup)?.title ?? link.codeGroup;
    edges.push({
      from, to, evidence: first.evidence, status: link.status,
      link: {
        fromGroup: link.codeGroup,
        toGroup: link.kind,
        fromTitle: titleOf,
        toTitle: kindLabel(link.kind),
        status: link.status,
        cycle: false,
        direction: link.direction,
        directionText: DIRECTION_TEXT[link.direction],
        imports: link.flows.map((flow) => ({ from: flow.from, to: flow.to, evidence: flow.evidence, status: flow.status }))
      }
    });
    if (link.status !== 'ok' && link.status !== 'pending') {
      lines.push(`    linkStyle ${at} stroke:#DC2626,stroke-width:3px;`);
    }
  });

  return {
    text: lines.join(LF), details, paths: {}, nodes, edges, neighbors: neighborsOf(edges),
    mapLegend: flowOverviewLegend(grouping, edges)
  };
}

export function userflowMermaid(map: ProjectMap): MermaidOutput {
  const { screens, transitions, calls } = map.userflow;
  if (screens.length === 0 && transitions.length === 0 && calls.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  const paths: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart TD'];
  lines.push('    classDef screen fill:#DBEAFE,stroke:#2563EB;');
  lines.push('    classDef api fill:#F3E8FF,stroke:#7C3AED;');

  for (const screen of screens) {
    const node = nodeId('u', screen.id);
    lines.push(`    ${node}["${label(screen.title ?? screen.id)}"]:::screen`);
    details[node] = [screen.id, screen.title, screen.file ? `файл: ${screen.file}` : ''].filter(Boolean).join(LF);
    if (screen.file) paths[node] = screen.file;
    nodes[node] = {
      id: screen.id, title: screen.title, path: screen.file, declaredBy: screen.declaredBy, pending: screen.pending
    };
  }
  declareImplicit(
    lines,
    details,
    'u',
    new Set(screens.map((screen) => screen.id)),
    [...transitions.flatMap((step) => [step.from, step.to]), ...calls.map((call) => call.from)]
  );

  // Порядок здесь и порядок `edges` ниже должны совпасть: сначала переходы,
  // потом вызовы — тем же порядком, каким они лягут строками в диаграмму.
  const edges: MermaidEdge[] = [];
  for (const step of transitions) {
    // Известен триггер — сплошная стрелка с подписью; неизвестен —
    // пунктиром: переход есть, а чем он вызывается, карта не говорит.
    const via = step.trigger ? `|${label(step.trigger, 24)}|` : '';
    const arrow = step.trigger ? '-->' : '-.->';
    const from = nodeId('u', step.from);
    const to = nodeId('u', step.to);
    lines.push(`    ${from} ${arrow}${via} ${to}`);
    edges.push({
      from, to, evidence: step.evidence, status: step.status, declaredBy: step.declaredBy, pending: step.pending
    });
  }
  for (const call of calls) {
    const node = nodeId('api', call.to);
    lines.push(`    ${node}(["${label(call.to)}"]):::api`);
    details[node] = call.to;
    nodes[node] = { id: call.to };
    const from = nodeId('u', call.from);
    lines.push(`    ${from} -.-> ${node}`);
    edges.push({
      from, to: node, evidence: call.evidence, status: call.status, declaredBy: call.declaredBy, pending: call.pending
    });
  }
  styleUnverified(lines, edges);
  return {
    text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges),
    mapLegend: userflowLegend(
      screens.length,
      new Set(calls.map((call) => call.to)).size,
      transitions,
      calls.length,
      edges,
      screens.filter((screen) => screen.pending).length
    )
  };
}

export type FunctionalMode = 'state' | 'coverage' | 'risks' | 'order';
export type FunctionalLevel = 'all' | 'groups' | 'group';

/** Слова на переключателе режимов окраски (docs/04-ui.md, «Режимы окраски»). */
export const FUNCTIONAL_MODE_LABEL: Record<FunctionalMode, string> = {
  state: 'Состояние',
  coverage: 'Покрытие',
  risks: 'Риски',
  order: 'Порядок'
};

/** Вид графа состояния поверх карты: уровень, режим окраски, фильтры и выбранная возможность. */
export interface FunctionalGraphOptions {
  mode?: FunctionalMode;
  level?: FunctionalLevel;
  /** Открытая группа — `id` возможности верхнего уровня; нужна при `level: 'group'`. */
  group?: string | null | undefined;
  /** Покрытие процессом: без него режимы «Покрытие» и «Риски» нечем красить. */
  coverage?: Readonly<Record<string, CapabilityCoverage>> | undefined;
  /** Скрытые виды связей: стрелки и строки легенды уходят вместе. */
  hiddenKinds?: ReadonlySet<string> | undefined;
  plan?: PlanFilter | undefined;
  /** «Только риски»: листья с признаком из режима «Риски» и их родители. */
  onlyRisks?: boolean | undefined;
  /** Рисовать легенду рамкой внутри текста диаграммы; `false` — только данные в `legend` (так делает экран). */
  legendInside?: boolean | undefined;
  /** Выбранная возможность: соседи из других групп «призраками» и влияние. */
  selected?: string | null | undefined;
  impact?: boolean | undefined;
}

interface Look {
  fill: string;
  stroke: string;
  color?: string;
  width?: number;
  dash?: boolean;
}

/** Цвета остальных режимов; состояние — те же `STATUS_STYLE`, что у дерева и сводки. */
const MODE_LOOK: Record<'coverage' | 'risks' | 'order', Record<string, Look>> = {
  coverage: {
    verified: { fill: '#DCFCE7', stroke: '#16A34A' },
    unchecked: { fill: '#ECFCCB', stroke: '#65A30D' },
    no_check: { fill: '#DBEAFE', stroke: '#2563EB' },
    none: { fill: '#F3F4F6', stroke: '#9CA3AF', dash: true },
    failing: { fill: '#FEE2E2', stroke: '#DC2626', width: 3 }
  },
  risks: {
    red: { fill: '#FEE2E2', stroke: '#DC2626', width: 3 },
    orange: { fill: '#FFEDD5', stroke: '#EA580C', width: 2 },
    yellow: { fill: '#FEF3C7', stroke: '#D97706' },
    none: { fill: '#F3F4F6', stroke: '#9CA3AF' }
  },
  order: {
    start: { fill: '#F0FDF4', stroke: '#16A34A', width: 3 },
    wait: { fill: '#FEF3C7', stroke: '#D97706' },
    done: { fill: '#ECFDF5', stroke: '#86EFAC', color: '#6B7280' },
    skip: { fill: '#F3F4F6', stroke: '#9CA3AF', color: '#6B7280', dash: true },
    unrated: { fill: '#F3F4F6', stroke: '#9CA3AF', dash: true }
  }
};

const MODE_PREFIX = { state: 'st', coverage: 'cv', risks: 'rk', order: 'or' } as const;

const MODE_LABEL: Record<'coverage' | 'risks' | 'order', Record<string, string>> = {
  coverage: COVERAGE_LABEL,
  risks: { red: 'Цикл или падающая проверка', orange: 'Отметка расходится с задачами', yellow: 'Ждёт зависимость', none: 'Без признаков' },
  order: { start: 'Можно начинать', wait: 'Ждёт зависимость', done: 'Готово', skip: 'Не берём', unrated: 'Не оценено' }
};

/** Образцы и стрелки видов связи: сплошная, пунктир, толстая, с кружком, с крестом. */
const KIND_ARROW: Record<string, string> = { depends: '-->', uses: '-.->', feeds: '==>', triggers: '--o', replaces: '--x' };
const KIND_COLOR: Record<string, string> = { triggers: '#7C3AED', replaces: '#6B7280' };
const KIND_ORDER = ['depends', 'uses', 'feeds', 'triggers', 'replaces'] as const;

const STATE_KEYS = ['implemented', 'partial', 'not_implemented', 'unrated'] as const;

function lookLine(cls: string, look: Look): string {
  const parts = [`fill:${look.fill}`, `stroke:${look.stroke}`, `color:${look.color ?? '#111827'}`];
  if (look.width) parts.push(`stroke-width:${look.width}px`);
  if (look.dash) parts.push('stroke-dasharray:4 3');
  return `    classDef ${cls} ${parts.join(',')};`;
}

function classDefsOf(mode: FunctionalMode): string[] {
  if (mode === 'state') {
    return STATE_KEYS.map((key) => lookLine(nodeId('st', key), { ...STATUS_STYLE[key], dash: key === 'unrated' }));
  }
  return Object.entries(MODE_LOOK[mode]).map(([key, look]) => lookLine(nodeId(MODE_PREFIX[mode], key), look));
}

function labelOf(mode: FunctionalMode, key: string): string {
  return mode === 'state' ? IMPL_LABEL[key as keyof typeof IMPL_LABEL] : (MODE_LABEL[mode][key] ?? key);
}

/** Какой класс и какие строки под названием получает нижняя возможность в этом режиме. */
function placement(
  mode: FunctionalMode,
  view: CapabilityView | undefined,
  titles: ReadonlyMap<string, string>
): { key: string; lines: string[] } {
  const stateKey = view?.status ?? 'unrated';
  const names = (ids: readonly string[]) => ids.map((id) => label(titles.get(id) ?? id, 24)).join(', ');
  const lines: string[] = [];
  let key: string = stateKey;

  if (mode === 'state') {
    const tasks = tasksText(view?.coverage);
    lines.push(tasks ? `${IMPL_LABEL[stateKey]} · ${tasks}` : IMPL_LABEL[stateKey]);
  } else if (mode === 'coverage') {
    const cover = view?.coverage;
    key = cover?.level ?? 'none';
    lines.push(COVERAGE_LABEL[cover?.level ?? 'none']);
    const counts = [
      cover?.requirements.total ? `треб. ${cover.requirements.total}` : '',
      cover?.tasks.total ? `задачи ${cover.tasks.done}/${cover.tasks.total}` : '',
      cover?.verifications.ids.length ? `проверки ${cover.verifications.passed}/${cover.verifications.ids.length}` : ''
    ].filter(Boolean);
    if (counts.length > 0) lines.push(counts.join(' · '));
  } else if (mode === 'risks') {
    const flags = view?.flags ?? [];
    key = riskLevel(flags);
    lines.push(flags.length > 0
      ? flags.map((flag) => (flag === 'waits' ? `ждёт: ${names(view?.waiting ?? [])}` : RISK_LABEL[flag])).join(' · ')
      : IMPL_LABEL[stateKey]);
  } else {
    if (view?.priority?.value === 'wont') key = 'skip';
    else if (stateKey === 'implemented') key = 'done';
    else if (view && view.waiting.length > 0) key = 'wait';
    else key = stateKey === 'unrated' ? 'unrated' : 'start';
    if (key === 'start') lines.push(view && view.unblocks > 0 ? `Можно начинать · освободит ${view.unblocks}` : 'Можно начинать');
    else if (key === 'wait') lines.push(`Ждёт: ${names(view?.waiting ?? [])}`);
    else lines.push(MODE_LABEL.order[key] ?? key);
    const plan = view ? planText(view) : '';
    // У «готово» и «не берём» приоритет уже сказан словом или ничего не решает.
    if (plan && key !== 'done' && key !== 'skip') lines.push(plan);
  }

  if (view && view.replacedBy.length > 0) lines.push(`заменяется на ${names(view.replacedBy)}`);
  return { key, lines };
}

interface DrawnLink {
  from: string;
  to: string;
  type: string;
  summary?: string | undefined;
  /** Подсказка процессу: цикл по depends или «ждёт» — по ним считается легенда. */
  hint?: 'cycle' | 'wait' | null;
  /** Стиль стрелки для `linkStyle`: он красит по порядковому номеру связи в тексте. */
  styles: string[];
}

/**
 * Граф состояния функциональной карты (docs/04-ui.md, «Функциональная карта»):
 * возможность — прямоугольник цвета своего состояния, родитель — рамка вокруг
 * подпунктов с названием и счётом, связь — стрелка одного из пяти видов.
 * Свидетельства нет вовсе (docs/07-maps.md) — узел ведёт только к своей
 * карточке, `paths` и `edges` у этого вида всегда пустые; а у связей собственного
 * смысла, кроме вида и подписи, нет, поэтому клика по стрелке тоже нет.
 *
 * Три уровня, как у кодовой карты: обзор групп (`groups`), одна группа
 * (`group`) с соседями выбранной возможности «призраками» и всё сразу (`all`).
 * Режим окраски отвечает на один вопрос за раз: состояние, покрытие, риски,
 * порядок. Прежний круговой `mindmap` убран: цвета ветвей в нём ничего не
 * значили, а линии наезжали на названия.
 */
export function functionalMermaid(
  map: ProjectMap,
  filter: StatusFilter | null = null,
  options: FunctionalGraphOptions = {}
): MermaidOutput {
  const everything = map.functional.capabilities;
  if (everything.length === 0) return EMPTY;
  const allRelations = map.functional.relations;
  const mode = options.mode ?? 'state';
  const level = options.level ?? 'all';

  // Состояние, «ждёт» и признаки считаются по всему дереву, а не по тому, что
  // осталось под фильтром или в открытой группе: иначе родитель менял бы цвет
  // от самого фильтра.
  const views = capabilityViews(everything, allRelations, options.coverage);
  const titles = new Map(everything.map((item) => [item.id, item.title ?? item.id]));

  const scope = level === 'group' && options.group
    ? groupScopeOf(everything, allRelations, options.group)
    : { capabilities: everything, relations: allRelations };

  // Один приём на все фильтры: лист остаётся, если подошёл под каждое условие.
  const plan = planPredicate(everything, options.plan ?? {});
  const keepLeaf = filter || plan || options.onlyRisks
    ? (leaf: (typeof everything)[number]) => {
      if (filter && !(filter === 'unrated' ? !isImplStatus(leaf.status) : leaf.status === filter)) return false;
      if (plan && !plan(leaf)) return false;
      if (options.onlyRisks && (views.get(leaf.id)?.flags.length ?? 0) === 0) return false;
      return true;
    }
    : null;
  const capabilities = filterLeaves(scope.capabilities, keepLeaf);
  if (capabilities.length === 0) return EMPTY;

  const relations = scope.relations.filter((relation) => !options.hiddenKinds?.has(relation.type));
  if (level === 'groups') return functionalOverview(everything, relations, capabilities, views, options.legendInside !== false);

  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const index = childrenIndex(capabilities);
  const shown = (id: string) => nodeId('f', id);

  const lines = [mode === 'order' ? 'flowchart RL' : 'flowchart LR', ...classDefsOf(mode)];

  const placed = new Set<string>();
  // Сколько нижних возможностей каждого класса нарисовано — для легенды.
  const classCount = new Map<string, number>();
  const leafNodes = new Map<string, string>();

  function leaf(item: (typeof capabilities)[number], pad: string): void {
    placed.add(item.id);
    const view = views.get(item.id);
    const { key, lines: text } = placement(mode, view, titles);
    classCount.set(key, (classCount.get(key) ?? 0) + 1);
    const node = shown(item.id);
    leafNodes.set(item.id, node);
    // Слово под названием: цвет — не единственный признак.
    lines.push(`${pad}${node}["${[label(item.title ?? item.id, 34), ...text.map((line) => label(line, 40))].join('<br/>')}"]:::${nodeId(MODE_PREFIX[mode], key)}`);
    details[node] = [item.id, item.title, ...text, item.note].filter(Boolean).join(LF);
    nodes[node] = {
      id: item.id, title: item.title, summary: item.summary, declaredBy: (item as { declaredBy?: string }).declaredBy,
      declaredAt: (item as { declaredAt?: string }).declaredAt, declaredByRole: (item as { declaredByRole?: string | null }).declaredByRole,
      pending: (item as { pending?: boolean }).pending, capability: true, note: item.note, ...(view ? { capabilityView: view } : {})
    };
  }

  function render(item: (typeof capabilities)[number], depth: number): void {
    // Схема не требует уникальности id: два элемента с одним id в разных ветках
    // нарисовали бы один узел дважды.
    if (placed.has(item.id)) return;
    const pad = '    '.repeat(depth + 1);
    // Уже стоящие на месте не считаем: рамка без единого содержимого ничего не рисует.
    const kids = (index.get(item.id) ?? []).filter((kid) => !placed.has(kid.id));
    if (kids.length === 0) {
      leaf(item, pad);
      return;
    }
    placed.add(item.id);
    const progress = views.get(item.id)?.progress;
    const score = progress ? ` · ${progress.implemented} из ${progress.total}` : '';
    lines.push(`${pad}subgraph ${shown(item.id)}["${label(item.title ?? item.id, 40)}${score}"]`);
    for (const kid of kids) render(kid, depth + 1);
    lines.push(`${pad}end`);
  }

  for (const top of index.get(null) ?? []) render(top, 0);
  // Ветка, замкнутая в цикл по `parent`, до корня не доходит — не теряем её молча.
  for (const item of capabilities) {
    if (!placed.has(item.id)) leaf(item, '    ');
  }

  // Призраки — соседи выбранной возможности из других групп (только в открытой группе).
  const ghostLinks: DrawnLink[] = [];
  const ghosts = level === 'group' && options.group && options.selected
    ? functionalGhosts(everything, allRelations, options.group, options.selected)
      .filter((ghost) => !options.hiddenKinds || ghost.links.some((link) => !options.hiddenKinds?.has(link.type)))
    : [];
  if (ghosts.length > 0 && leafNodes.has(options.selected as string)) {
    lines.push('    classDef ghost fill:#F3F4F6,stroke:#6B7280,color:#111827,stroke-dasharray:5 4;');
    lines.push('    subgraph ghosts["Из других групп"]');
    const collapse = ghosts.length > FUNCTIONAL_GHOST_LIMIT;
    const drawnGhosts = collapse
      ? [...new Map(ghosts.map((ghost) => [ghost.groupId, ghost])).values()]
      : ghosts;
    for (const ghost of drawnGhosts) {
      const node = collapse ? nodeId('fgg', ghost.groupId) : shown(ghost.id);
      const members = ghosts.filter((other) => other.groupId === ghost.groupId);
      const name = collapse ? `${ghost.groupTitle} · ${members.length} ${members.length === 1 ? 'возможность' : 'возможностей'}` : ghost.title;
      lines.push(`        ${node}["${label(name, 34)}<br/>из группы ${label(ghost.groupTitle, 28)}"]:::ghost`);
      details[node] = [collapse ? ghost.groupId : ghost.id, name, `из группы ${ghost.groupTitle}`].join(LF);
      const view = views.get(collapse ? ghost.groupId : ghost.id);
      nodes[node] = {
        id: collapse ? ghost.groupId : ghost.id, title: collapse ? ghost.groupTitle : ghost.title,
        ghost: { groupId: ghost.groupId, groupTitle: ghost.groupTitle }, capability: true,
        capabilityGroup: ghost.groupId, ...(view ? { capabilityView: view } : {})
      };
    }
    lines.push('    end');

    const chosen = shown(options.selected as string);
    const seen = new Set<string>();
    for (const ghost of ghosts) {
      const node = collapse ? nodeId('fgg', ghost.groupId) : shown(ghost.id);
      for (const link of ghost.links) {
        if (options.hiddenKinds?.has(link.type)) continue;
        const key = `${node}:${link.direction}:${link.type}`;
        // Свёрнутые призраки: одна стрелка на группу и вид, а не на каждую связь.
        if (collapse && seen.has(key)) continue;
        seen.add(key);
        ghostLinks.push({
          from: link.direction === 'out' ? chosen : node,
          to: link.direction === 'out' ? node : chosen,
          type: link.type,
          summary: collapse ? undefined : link.summary,
          styles: []
        });
      }
    }
  }
  const { drawn } = drawableRelations(relations, capabilities);
  const waiting = new Set(drawn.filter((relation) => (views.get(relation.from)?.waiting ?? []).includes(relation.to)));
  const drawnLinks: DrawnLink[] = drawn.map((relation) => {
    const cyclic = relation.type === 'depends' && views.get(relation.from)?.inCycle && views.get(relation.to)?.inCycle;
    const hint: DrawnLink['hint'] = cyclic ? 'cycle' : waiting.has(relation) ? 'wait' : null;
    return {
      from: shown(relation.from),
      to: shown(relation.to),
      type: relation.type,
      summary: relation.summary,
      hint,
      styles: cyclic ? ['stroke:#DC2626', 'stroke-width:3px']
        : waiting.has(relation) ? ['stroke:#D97706', 'stroke-width:2px']
          : KIND_COLOR[relation.type] ? [`stroke:${KIND_COLOR[relation.type]}`, 'stroke-width:2px'] : []
    };
  });
  const cycles = drawnLinks.filter((link) => link.hint === 'cycle').length;
  const waits = drawnLinks.filter((link) => link.hint === 'wait').length;

  // Влияние: выбранная, то, на чём она стоит, и то, что её заденет; остальное приглушено.
  const impactLines: string[] = [];
  const impactCount = { up: 0, down: 0 };
  const dimmedEdges = new Set<number>();
  if (options.impact && options.selected && leafNodes.has(options.selected)) {
    const impact = impactOf(options.selected, allRelations, everything);
    const up = new Set(impact.reliesOn);
    const down = new Set(impact.reliedOnBy);
    const chain = new Set([options.selected, ...up, ...down]);
    const classes: Record<string, string[]> = { imp_self: [], imp_up: [], imp_down: [], imp_dim: [] };
    for (const [id, node] of leafNodes) {
      if (id === options.selected) classes['imp_self']?.push(node);
      else if (up.has(id)) classes['imp_up']?.push(node);
      else if (down.has(id)) classes['imp_down']?.push(node);
      else classes['imp_dim']?.push(node);
    }
    impactCount.up = classes['imp_up']?.length ?? 0;
    impactCount.down = classes['imp_down']?.length ?? 0;
    impactLines.push(
      '    classDef imp_self stroke:#111827,stroke-width:4px;',
      '    classDef imp_up stroke:#2563EB,stroke-width:4px;',
      '    classDef imp_down stroke:#7C3AED,stroke-width:4px;',
      '    classDef imp_dim opacity:0.3;'
    );
    for (const [cls, ids] of Object.entries(classes)) {
      if (ids.length > 0) impactLines.push(`    class ${ids.join(',')} ${cls};`);
    }
    drawn.forEach((relation, at) => {
      if (!chain.has(relation.from) || !chain.has(relation.to)) dimmedEdges.add(at);
    });
  }

  const everyLink = [...drawnLinks, ...ghostLinks];
  const kindCount: Record<string, number> = {};
  everyLink.forEach((link, at) => {
    kindCount[link.type] = (kindCount[link.type] ?? 0) + 1;
    const caption = link.summary ? `|"${label(link.summary, 28).replace(/\|/g, '/')}"|` : '';
    lines.push(`    ${link.from} ${KIND_ARROW[link.type]}${caption} ${link.to}`);
    const styles = dimmedEdges.has(at) ? [...link.styles, 'stroke-opacity:0.2'] : link.styles;
    if (styles.length > 0) impactLines.push(`    linkStyle ${at} ${styles.join(',')};`);
  });
  lines.push(...impactLines);

  const entries = [...classCount].map(([key, count]) => ({
    key, cls: nodeId(MODE_PREFIX[mode], key), label: labelOf(mode, key), count
  }));
  entries.sort((a, b) => order(mode, a.key) - order(mode, b.key));
  if (options.impact && impactCount.up + impactCount.down > 0) {
    if (impactCount.up > 0) entries.push({ key: 'impact_up', cls: 'imp_up', label: 'На чём стоит', count: impactCount.up });
    if (impactCount.down > 0) entries.push({ key: 'impact_down', cls: 'imp_down', label: 'Что заденет', count: impactCount.down });
  }
  if (options.legendInside !== false) lines.push(...functionalLegend(entries, kindCount, { waits, cycles }, everyLink.length));

  return {
    text: lines.join(LF),
    legend: legendOf(entries, kindCount, { waits, cycles }),
    details,
    paths: {},
    nodes,
    edges: [],
    neighbors: neighborsOf(everyLink.map((link) => ({ from: link.from, to: link.to })))
  };
}

/** Порядок строк легенды: как на переключателе, а не как встретились в карте. */
function order(mode: FunctionalMode, key: string): number {
  const keys = mode === 'state' ? [...STATE_KEYS] : Object.keys(MODE_LOOK[mode]);
  const at = keys.indexOf(key);
  return at < 0 ? keys.length : at;
}

/**
 * Обзор групп: узел — возможность верхнего уровня со счётом «5 из 8», стрелка —
 * свёрнутые связи между потомками двух групп, подпись — их число. Группы, что
 * ждут друг друга по `depends`, краснеют: на уровне возможностей этот цикл распылён.
 * Фильтры оставляют только группы, где есть подходящие возможности.
 */
function functionalOverview(
  everything: ProjectMap['functional']['capabilities'],
  relations: ProjectMap['functional']['relations'],
  kept: ProjectMap['functional']['capabilities'],
  views: ReadonlyMap<string, CapabilityView>,
  inside: boolean
): MermaidOutput {
  const level = groupLevel(everything, relations);
  const keep = new Set(kept.map((item) => rootOf(item.id, everything)));
  const groups = level.groups.filter((group) => keep.has(group.id));
  if (groups.length === 0) return EMPTY;
  const shownGroup = new Set(groups.map((group) => group.id));
  const node = (id: string) => nodeId('fgrp', id);

  const lines = ['flowchart LR', ...classDefsOf('state')];
  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const classCount = new Map<string, number>();

  for (const group of groups) {
    const key = group.status ?? 'unrated';
    classCount.set(key, (classCount.get(key) ?? 0) + 1);
    const progress = group.progress;
    const score = progress.total > 0 ? `${progress.implemented} из ${progress.total}` : '';
    lines.push(`    ${node(group.id)}["${[label(group.title, 34), score, IMPL_LABEL[key]].filter(Boolean).join('<br/>')}"]:::${nodeId('st', key)}`);
    const root = everything.find((item) => item.id === group.id);
    details[node(group.id)] = [group.id, group.title, IMPL_LABEL[key], score].filter(Boolean).join(LF);
    nodes[node(group.id)] = {
      id: group.id, title: group.title, summary: root?.summary, note: root?.note,
      declaredBy: (root as { declaredBy?: string } | undefined)?.declaredBy,
      declaredAt: (root as { declaredAt?: string } | undefined)?.declaredAt,
      declaredByRole: (root as { declaredByRole?: string | null } | undefined)?.declaredByRole,
      pending: (root as { pending?: boolean } | undefined)?.pending,
      capability: true, capabilityGroup: group.id,
      ...(views.get(group.id) ? { capabilityView: views.get(group.id) as CapabilityView } : {})
    };
  }

  const kindCount: Record<string, number> = {};
  const edges = level.edges.filter((edge) => shownGroup.has(edge.from) && shownGroup.has(edge.to));
  const styles: string[] = [];
  let cycles = 0;
  let waits = 0;
  edges.forEach((edge, at) => {
    kindCount[edge.type] = (kindCount[edge.type] ?? 0) + 1;
    lines.push(`    ${node(edge.from)} ${KIND_ARROW[edge.type]}|"${edge.count > 1 ? `${edge.count} связей` : '1 связь'}"| ${node(edge.to)}`);
    const cyclic = edge.type === 'depends' && level.cycle.has(edge.from) && level.cycle.has(edge.to);
    if (cyclic) {
      cycles += 1;
      styles.push(`    linkStyle ${at} stroke:#DC2626,stroke-width:3px;`);
    } else if (edge.waiting) {
      waits += 1;
      styles.push(`    linkStyle ${at} stroke:#D97706,stroke-width:2px;`);
    } else if (KIND_COLOR[edge.type]) {
      styles.push(`    linkStyle ${at} stroke:${KIND_COLOR[edge.type]},stroke-width:2px;`);
    }
  });
  lines.push(...styles);

  const entries = STATE_KEYS
    .filter((key) => classCount.has(key))
    .map((key) => ({ key, cls: nodeId('st', key), label: IMPL_LABEL[key], count: classCount.get(key) as number }));
  if (inside) lines.push(...functionalLegend(entries, kindCount, { waits, cycles }, edges.length));

  return { text: lines.join(LF), legend: legendOf(entries, kindCount, { waits, cycles }), details, paths: {}, nodes, edges: [], neighbors: neighborsOf(edges.map((edge) => ({ from: node(edge.from), to: node(edge.to) }))) };
}

const KIND_NAME: Record<string, string> = {
  depends: 'зависит от', uses: 'пользуется', feeds: 'передаёт данные в', triggers: 'запускает', replaces: 'заменяет'
};

/** Цвет класса узла: тот же, что в `classDef`, — по префиксу класса. */
function lookOfClass(cls: string): Look {
  const key = cls.slice(cls.indexOf('_') + 1);
  const prefix = cls.slice(0, cls.indexOf('_'));
  if (prefix === 'st') return { ...STATUS_STYLE[key as keyof typeof STATUS_STYLE], dash: key === 'unrated' };
  if (cls === 'imp_up') return { fill: '#FFFFFF', stroke: '#2563EB', width: 4 };
  if (cls === 'imp_down') return { fill: '#FFFFFF', stroke: '#7C3AED', width: 4 };
  const mode = ({ cv: 'coverage', rk: 'risks', or: 'order' } as const)[prefix as 'cv' | 'rk' | 'or'];
  return (mode && MODE_LOOK[mode][key]) || { fill: '#F3F4F6', stroke: '#9CA3AF' };
}

function legendOf(
  entries: readonly { key: string; cls: string; label: string; count: number }[],
  kinds: Record<string, number>,
  hints: { waits: number; cycles: number }
): FunctionalLegend {
  return {
    entries: entries.map((entry) => {
      const look = lookOfClass(entry.cls);
      return { key: entry.key, label: entry.label, count: entry.count, fill: look.fill, stroke: look.stroke, dash: !!look.dash };
    }),
    kinds: KIND_ORDER.filter((kind) => kinds[kind]).map((kind) => ({ kind, text: KIND_NAME[kind] as string, count: kinds[kind] as number })),
    hints
  };
}

/**
 * Легенда рамкой внутри текста диаграммы (docs/04-ui.md, «Граф состояния»): рамка внутри
 * диаграммы, поэтому уходит и в выгруженный SVG, и в «Скопировать mermaid».
 * Правило одно — в ней только то, что нарисовано, и с числом. Образцы стрелок —
 * настоящие связи между безымянными узлами, поэтому их порядок в тексте
 * продолжает порядок рёбер диаграммы (`linkStyle` красит по номеру).
 */
function functionalLegend(
  entries: readonly { key: string; cls: string; label: string; count: number }[],
  kinds: Record<string, number>,
  hints: { waits: number; cycles: number },
  drawnEdges: number
): string[] {
  const lines = ['    classDef legend_blank fill:none,stroke:none,color:#6B7280;', '    subgraph legend["Легенда"]'];
  for (const entry of entries) {
    lines.push(`        legend_s_${entry.key}["${entry.label} · ${entry.count}"]:::${entry.cls}`);
  }

  const samples: { arrow: string; text: string; style?: string }[] = [];
  const names: Record<string, string> = {
    depends: 'зависит от', uses: 'пользуется', feeds: 'передаёт данные в', triggers: 'запускает', replaces: 'заменяет'
  };
  for (const kind of KIND_ORDER) {
    if (!kinds[kind]) continue;
    samples.push({
      arrow: KIND_ARROW[kind] as string,
      text: `${names[kind]} · ${kinds[kind]}`,
      ...(KIND_COLOR[kind] ? { style: `stroke:${KIND_COLOR[kind]},stroke-width:2px` } : {})
    });
  }
  if (hints.waits) {
    samples.push({ arrow: '-->', text: `жёлтая — ждёт зависимость · ${hints.waits}`, style: 'stroke:#D97706,stroke-width:2px' });
  }
  if (hints.cycles) {
    samples.push({ arrow: '-->', text: `красная — ждут друг друга · ${hints.cycles}`, style: 'stroke:#DC2626,stroke-width:3px' });
  }

  if (samples.length === 0) {
    lines.push('        legend_note["Связей между возможностями пока нет"]:::legend_blank');
  }
  const styled: string[] = [];
  samples.forEach((sample, at) => {
    lines.push(`        legend_l${at}a[" "]:::legend_blank ${sample.arrow}|"${sample.text}"| legend_l${at}b[" "]:::legend_blank`);
    if (sample.style) styled.push(`    linkStyle ${drawnEdges + at} ${sample.style};`);
  });
  lines.push('    end', ...styled);
  return lines;
}

function modulesWord(count: number): string {
  const last = count % 10;
  const tens = count % 100;
  if (last === 1 && tens !== 11) return 'модуль';
  if (last >= 2 && last <= 4 && (tens < 12 || tens > 14)) return 'модуля';
  return 'модулей';
}

/**
 * Обзор групп (docs/04-ui.md, «Группы кодовой карты»): узел — группа, стрелка —
 * свёрнутые импорты с их числом. Группы, зависящие друг от друга по кругу,
 * подсвечены: на уровне модулей этот цикл распылён и не виден. Расхождение
 * свидетельств не растворяется в сумме — стрелка краснеет, если не сошёлся
 * хоть один из её импортов.
 */
export function groupOverviewMermaid(grouping: Grouping): MermaidOutput {
  const { groups, links } = grouping;
  if (groups.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];
  lines.push(...classDefs(new Set(groups.map((group) => group.id)), 'grp'));

  for (const group of groups) {
    const node = nodeId('g', group.id);
    const count = group.members.length;
    const tail = `${count} ${modulesWord(count)}${group.auto ? ' · авто' : ''}`;
    lines.push(`    ${node}["${label(group.title, 34)}<br/>${tail}"]:::${nodeId('grp', group.id)}`);
    details[node] = [group.title, group.summary, tail].filter(Boolean).join(LF);
    const card = groupCard(grouping, group.id);
    nodes[node] = {
      id: group.id, title: group.title, layer: group.title, summary: group.summary,
      ...(card ? { group: card } : {})
    };
  }

  const edges: MermaidEdge[] = [];
  const styled: string[] = [];
  links.forEach((link, at) => {
    const from = nodeId('g', link.from);
    const to = nodeId('g', link.to);
    lines.push(`    ${from} -->|${link.imports.length}| ${to}`);
    const first = link.imports[0];
    if (!first) return;
    edges.push({
      from, to, evidence: first.evidence, status: link.status,
      link: {
        fromGroup: link.from,
        toGroup: link.to,
        fromTitle: grouping.byId.get(link.from)?.title ?? link.from,
        toTitle: grouping.byId.get(link.to)?.title ?? link.to,
        status: link.status,
        cycle: link.cycle,
        imports: link.imports.map((item) => ({ from: item.from, to: item.to, evidence: item.evidence, status: item.status }))
      }
    });
    const bad = link.status !== 'ok' && link.status !== 'pending';
    if (bad) styled.push(`    linkStyle ${at} stroke:#DC2626,stroke-width:3px;`);
    else if (link.cycle) styled.push(`    linkStyle ${at} stroke:#D97706,stroke-width:3px;`);
  });
  lines.push(...styled);

  return {
    text: lines.join(LF), details, paths: {}, nodes, edges, neighbors: neighborsOf(edges),
    mapLegend: groupOverviewLegend(groups, links, edges)
  };
}
