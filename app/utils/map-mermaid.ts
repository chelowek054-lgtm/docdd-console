import {
  IMPL_LABEL,
  childrenIndex,
  drawableRelations,
  filterByStatus,
  type StatusFilter
} from '../../server/lib/functional';
import type { ApiItem, Evidence, EvidenceVerdict, ProjectMap } from '../../server/lib/maps';
import { STATUS_STYLE, capabilityViews, type CapabilityView } from './functional-view';

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
  /** См. `MermaidEdge.pending` — то же самое, но у узла. */
  pending?: boolean;
  /** Возможность функциональной карты: у неё нет ни файла, ни интерфейса, только название и описание. */
  capability?: boolean;
  /** Что сделано и чего не хватает — `note` возможности. */
  note?: string | undefined;
  /** Состояние, связи и «ждёт» возможности (`app/utils/functional-view.ts`). */
  capabilityView?: CapabilityView;
}

/** Что показывает `MapInspector.vue` — узел (по `MermaidNode`) или ребро (по `MermaidEdge`). */
export type MapSelection =
  | ({ kind: 'node' } & MermaidNode)
  | ({ kind: 'edge' } & Pick<MermaidEdge, 'evidence' | 'status' | 'declaredBy'>);

export interface MermaidOutput {
  text: string;
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
  return [...categories].map((category) => `    classDef ${nodeId(prefix, category)} fill:${colorOf(category)},stroke:#6B7280;`);
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

export function codemapMermaid(map: ProjectMap): MermaidOutput {
  const { modules, imports } = map.codemap;
  if (modules.length === 0 && imports.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  const paths: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];
  // Слои становятся подграфами: колонка на слой читается лучше клубка.
  const layers = new Map<string, typeof modules>();
  for (const module of modules) {
    const layer = module.layer ?? 'без слоя';
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
        summary: module.summary, api: module.api, declaredBy: module.declaredBy, pending: module.pending
      };
    }
    lines.push('    end');
  }

  declareImplicit(
    lines,
    details,
    'm',
    new Set(modules.map((module) => module.id)),
    imports.flatMap((edge) => [edge.from, edge.to])
  );

  const edges: MermaidEdge[] = [];
  for (const edge of imports) {
    const from = nodeId('m', edge.from);
    const to = nodeId('m', edge.to);
    lines.push(`    ${from} --> ${to}`);
    edges.push({
      from, to, evidence: edge.evidence, status: edge.status, declaredBy: edge.declaredBy, pending: edge.pending
    });
  }
  styleUnverified(lines, edges);
  return { text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges) };
}

const SOURCE_KIND_LABEL: Record<string, string> = {
  file: 'файл',
  http: 'http',
  db: 'база данных',
  queue: 'очередь',
  env: 'переменная окружения',
  memory: 'память процесса'
};

export function dataflowMermaid(map: ProjectMap): MermaidOutput {
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
  }

  const edges: MermaidEdge[] = [];
  for (const flow of flows) {
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
  return { text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges) };
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
  return { text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges) };
}

/**
 * Граф состояния функциональной карты (docs/04-ui.md, «Функциональная карта»):
 * возможность — прямоугольник цвета своего состояния, родитель — рамка вокруг
 * подпунктов с названием и счётом, связь — стрелка одного из трёх видов.
 * Свидетельства нет вовсе (docs/07-maps.md) — узел ведёт только к своей
 * карточке, `paths` и `edges` у этого вида всегда пустые; а у связей собственного
 * смысла, кроме вида и подписи, нет, поэтому клика по стрелке тоже нет.
 *
 * Прежний круговой `mindmap` убран: цвета ветвей в нём ничего не значили, а
 * линии наезжали на названия.
 */
export function functionalMermaid(map: ProjectMap, filter: StatusFilter | null = null): MermaidOutput {
  const all = map.functional.capabilities;
  if (all.length === 0) return EMPTY;

  // Состояние и «ждёт» считаются по всему дереву, а не по тому, что осталось
  // под фильтром: иначе родитель менял бы цвет от самого фильтра.
  const views = capabilityViews(all, map.functional.relations);
  const capabilities = filterByStatus(all, filter);
  if (capabilities.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const index = childrenIndex(capabilities);
  const shown = (id: string) => nodeId('f', id);

  const lines = ['flowchart LR'];
  for (const key of ['implemented', 'partial', 'not_implemented', 'unrated'] as const) {
    const style = STATUS_STYLE[key];
    const dash = key === 'unrated' ? ',stroke-dasharray:4 3' : '';
    lines.push(`    classDef ${nodeId('st', key)} fill:${style.fill},stroke:${style.stroke},color:#111827${dash};`);
  }

  const placed = new Set<string>();

  function leaf(item: (typeof capabilities)[number], pad: string): void {
    placed.add(item.id);
    const view = views.get(item.id);
    const key = view?.status ?? 'unrated';
    const node = shown(item.id);
    // Слово под названием: цвет — не единственный признак состояния.
    lines.push(`${pad}${node}["${label(item.title ?? item.id, 34)}<br/>${IMPL_LABEL[key]}"]:::${nodeId('st', key)}`);
    details[node] = [item.id, item.title, IMPL_LABEL[key], item.note].filter(Boolean).join(LF);
    nodes[node] = {
      id: item.id, title: item.title, summary: item.summary, declaredBy: (item as { declaredBy?: string }).declaredBy,
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

  const { drawn } = drawableRelations(map.functional.relations, capabilities);
  const waiting = new Set(drawn.filter((relation) => (views.get(relation.from)?.waiting ?? []).includes(relation.to)));
  const arrows: Record<string, string> = { depends: '-->', uses: '-.->', feeds: '==>' };
  const drawnLinks: { from: string; to: string }[] = [];
  const styled: string[] = [];

  drawn.forEach((relation, at) => {
    const from = shown(relation.from);
    const to = shown(relation.to);
    const caption = relation.summary ? `|"${label(relation.summary, 28).replace(/\|/g, '/')}"|` : '';
    lines.push(`    ${from} ${arrows[relation.type]}${caption} ${to}`);
    drawnLinks.push({ from, to });
    const cyclic = views.get(relation.from)?.inCycle && views.get(relation.to)?.inCycle && relation.type === 'depends';
    if (cyclic) styled.push(`    linkStyle ${at} stroke:#DC2626,stroke-width:3px;`);
    else if (waiting.has(relation)) styled.push(`    linkStyle ${at} stroke:#D97706,stroke-width:2px;`);
  });
  lines.push(...styled);

  return { text: lines.join(LF), details, paths: {}, nodes, edges: [], neighbors: neighborsOf(drawnLinks) };
}
