import type { ApiItem, Evidence, EvidenceVerdict, ProjectMap } from '../../server/lib/maps';

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
function neighborsOf(edges: readonly MermaidEdge[]): Record<string, string[]> {
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

function colorOf(key: string): string {
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
        summary: module.summary, api: module.api, declaredBy: module.declaredBy
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
    edges.push({ from, to, evidence: edge.evidence, status: edge.status, declaredBy: edge.declaredBy });
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
      declaredBy: source.declaredBy
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
    edges.push({ from, to, evidence: flow.evidence, status: flow.status, declaredBy: flow.declaredBy });
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
    nodes[node] = { id: screen.id, title: screen.title, path: screen.file, declaredBy: screen.declaredBy };
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
    edges.push({ from, to, evidence: step.evidence, status: step.status, declaredBy: step.declaredBy });
  }
  for (const call of calls) {
    const node = nodeId('api', call.to);
    lines.push(`    ${node}(["${label(call.to)}"]):::api`);
    details[node] = call.to;
    nodes[node] = { id: call.to };
    const from = nodeId('u', call.from);
    lines.push(`    ${from} -.-> ${node}`);
    edges.push({ from, to: node, evidence: call.evidence, status: call.status, declaredBy: call.declaredBy });
  }
  styleUnverified(lines, edges);
  return { text: lines.join(LF), details, paths, nodes, edges, neighbors: neighborsOf(edges) };
}

/**
 * Дерево возможностей — не flowchart: тут нет рёбер со своим смыслом, только
 * вложенность, и mermaid для этого держит отдельный вид (`mindmap`). Доменный
 * специалист читает вложенность как есть, без легенды про стрелки и формы.
 * Цвет по ветке mindmap расставляет сам — раскрашивать его классами незачем.
 * Свидетельства нет вовсе (docs/07-maps.md) — узел ведёт только к своему
 * месту в дереве, `paths` и `edges` у этого вида всегда пустые.
 */
export function functionalMermaid(map: ProjectMap): MermaidOutput {
  const { capabilities } = map.functional;
  if (capabilities.length === 0) return EMPTY;

  const details: Record<string, string> = {};
  // Скобки ломают синтаксис узла mindmap (`id(текст)`) — в flowchart их
  // прятала кавычка вокруг подписи, здесь кавычки нет.
  const safe = (text: string) => label(text).replace(/[()]/g, ' ');

  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const ROOT = Symbol('root');
  const childrenOf = new Map<string | typeof ROOT, typeof capabilities>();
  for (const item of capabilities) {
    const parent: string | typeof ROOT = item.parent && byId.has(item.parent) ? item.parent : ROOT;
    childrenOf.set(parent, [...(childrenOf.get(parent) ?? []), item]);
  }

  const lines = ['mindmap'];
  const placed = new Set<string>();

  function render(item: (typeof capabilities)[number], depth: number): void {
    // Схема не требует уникальности id: два элемента с одним и тем же id в
    // разных ветках дерева нарисовали бы один узел дважды, с двух разных
    // мест сразу — mermaid запутается, какое определение верное.
    if (placed.has(item.id)) return;
    placed.add(item.id);
    const node = nodeId('f', item.id);
    lines.push(`${'  '.repeat(depth)}${node}(${safe(item.title ?? item.id)})`);
    details[node] = [item.id, item.title].filter(Boolean).join(LF);
    for (const child of childrenOf.get(item.id) ?? []) render(child, depth + 1);
  }

  const tops = childrenOf.get(ROOT) ?? [];
  if (tops.length === 1 && tops[0]) {
    render(tops[0], 1);
  } else {
    // Mindmap — дерево с одним корнем; несколько верхних возможностей разом
    // собираем под общим узлом, а не молча теряем часть картины.
    lines.push('  root((Проект))');
    for (const top of tops) render(top, 2);
  }

  return { text: lines.join(LF), details, paths: {}, nodes: {}, edges: [], neighbors: {} };
}
