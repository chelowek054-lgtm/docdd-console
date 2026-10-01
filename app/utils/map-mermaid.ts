import type { ApiItem, Evidence, EvidenceVerdict, ProjectMap } from '../../server/lib/maps';
import {
  STATE_LABEL, relationHints, relationsOf, summarize, tallyText,
  type CapabilityState, type CapabilityStatus, type RelationKind
} from '../../server/lib/functional';

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
  /** Нет у связи возможностей: у функциональной карты свидетельства нет вовсе (docs/07-maps.md). */
  evidence?: Evidence;
  /** Связь между возможностями вместо свидетельства: вид, подпись и подсказка «круг». */
  relation?: EdgeRelation;
  /** Свёрнутая стрелка между группами вместо одного свидетельства. */
  groupLink?: EdgeGroupLink;
  status?: EvidenceVerdict;
  /** Какая карта последней объявила эту связь (`server/lib/maps.ts`, `declaredBy`). */
  declaredBy?: string;
  /** Карта-источник ещё не устоялась — архитектор описал намерение, кода может не быть (`server/lib/maps.ts`). */
  pending?: boolean;
}

/** Связь между возможностями на ребре — то, что карточка ребра показывает вместо свидетельства. */
export interface EdgeRelation {
  kind: RelationKind;
  summary?: string;
  /** Исходные `id` возможностей: у `MermaidEdge.from/to` — id узлов диаграммы. */
  fromId: string;
  toId: string;
  /** Лежит на круге зависимостей. */
  cycle: boolean;
}

/**
 * Стрелка между группами: свёртка импортов в одну (docs/07-maps.md, «Группы»).
 * Раскрытие показывает исходные импорты со свидетельствами, поэтому сверка не
 * теряется — вердикт стрелки худший из свёрнутых.
 */
export interface EdgeGroupLink {
  fromGroup: string;
  toGroup: string;
  fromTitle: string;
  toTitle: string;
  count: number;
  status: EvidenceVerdict;
  cycle: boolean;
  /** Понятная подпись связи; нет — у стрелки остаётся число. */
  summary?: string;
  imports: { from: string; to: string; evidence: Evidence; status?: EvidenceVerdict }[];
}

/** Что карточка знает о группе (docs/04-ui.md, «Группы кодовой карты»). */
export interface GroupCard {
  id: string;
  title: string;
  /** Посчитана по пути, а не объявлена в карте. */
  auto: boolean;
  summary?: string;
  modules: number;
  /** Из чего состав: сколько модулей названо поимённо, поймано префиксом и посчитано по пути. */
  sources: { named: number; prefix: number; auto: number };
  /** Возможность функциональной карты, которую группа реализует. */
  capability?: { id: string; title?: string };
  /** Публичная поверхность: модули группы, которые импортируют снаружи. */
  surface: { id: string; title?: string }[];
  links: { direction: 'out' | 'in'; other: string; otherTitle: string; count: number; status: EvidenceVerdict; cycle: boolean }[];
}

/** Связь возможности, как её показывает карточка: с названием второй стороны. */
export interface NodeRelation {
  direction: 'out' | 'in';
  kind: RelationKind;
  other: string;
  otherTitle?: string;
  summary?: string;
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
  /** Состояние реализации возможности (docs/07-maps.md); нет — «не оценено». */
  status?: CapabilityStatus;
  /** Что сделано и чего не хватает — к состоянию реализации. */
  note?: string;
  /** Счёт нижних возможностей под родителем: «5 из 8 реализовано, 2 не оценено». */
  progress?: string;
  /** Входящие и исходящие связи возможности. */
  relations?: NodeRelation[];
  /** Названия возможностей, чьей реализации эта ждёт. */
  waitsFor?: string[];
  /** Зависит по кругу. */
  inCycle?: boolean;
  /** Узел обзора — группа, а не модуль. */
  group?: GroupCard;
  /** Модуль соседней группы, показанный призраком у выбранного модуля: название его группы. */
  ghostOf?: string;
  /** Порт группы: у модуля есть импорт через границу группы. */
  port?: boolean;
}

/**
 * Что показывает `MapInspector.vue`: узел (по `MermaidNode`), ребро со
 * свидетельством (по `MermaidEdge`) или связь между возможностями.
 */
export type MapSelection =
  | ({ kind: 'node' } & MermaidNode)
  | ({ kind: 'edge' } & Pick<MermaidEdge, 'status' | 'declaredBy'> & { evidence: Evidence })
  | ({ kind: 'group-link' } & EdgeGroupLink & { declaredBy?: string })
  | ({
    kind: 'relation';
    /** Вид связи — отдельным полем: `kind` занят различием вариантов выбора. */
    relationKind: RelationKind;
    fromTitle?: string;
    toTitle?: string;
    declaredBy?: string;
    pending?: boolean;
  } & Pick<EdgeRelation, 'summary' | 'fromId' | 'toId' | 'cycle'>);

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
export const EMPTY: MermaidOutput = { text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} };

/** `neighbors` — из уже собранных рёбер, один проход, обе стороны сразу. */
export function neighborsOf(edges: readonly MermaidEdge[]): Record<string, string[]> {
  const map = new Map<string, Set<string>>();
  const link = (a: string, b: string) => map.set(a, (map.get(a) ?? new Set()).add(b));
  for (const edge of edges) {
    link(edge.from, edge.to);
    link(edge.to, edge.from);
  }
  return Object.fromEntries([...map].map(([id, set]) => [id, [...set]]));
}

/** Идентификатор узла для mermaid: путь с точками и слешами он не переваривает. */
export function nodeId(prefix: string, value: string): string {
  return `${prefix}_${value.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}`;
}

export function label(text: string, limit = 40): string {
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
export function classDefs(categories: ReadonlySet<string>, prefix: string): string[] {
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
 * Заливка и обводка узла по состоянию реализации. Текст чёрный в обеих темах:
 * заливка светлая (как у палитры слоёв, `PALETTE`), и светлый текст тёмной темы
 * на ней не читался бы.
 */
const STATE_FILL: Record<CapabilityState, { fill: string; stroke: string }> = {
  implemented: { fill: '#DCFCE7', stroke: '#16A34A' },
  partial: { fill: '#FEF3C7', stroke: '#D97706' },
  not_implemented: { fill: '#FEE2E2', stroke: '#DC2626' },
  unassessed: { fill: '#F3F4F6', stroke: '#9CA3AF' }
};

const RELATION_ARROW: Record<RelationKind, string> = { depends: '-->', uses: '-.->', feeds: '==>' };

/** Подпись на стрелке: `|` и кавычки ломают синтаксис ребра mermaid. */
function edgeLabel(text: string): string {
  return label(text.replace(/\|/g, '/'), 24);
}

/**
 * Граф состояния функциональной карты (docs/04-ui.md, «Функциональная карта»).
 * Раньше её рисовал круговой `mindmap`: цвета веток ничего не значили, а линии
 * наезжали на названия. Теперь цвет — состояние реализации, родитель — рамка
 * вокруг своих подпунктов со счётом, а между возможностями идут стрелки трёх
 * видов: сплошная «зависит», пунктирная «пользуется», толстая «передаёт данные».
 * Нет свидетельства — значит нет `paths`, и ребро ведёт не к файлу, а к самой
 * связи (`MermaidEdge.relation`).
 *
 * `visible` — фильтр по состоянию: рисуются только эти возможности, а счёт и
 * подсказки по-прежнему считаются по всей карте, иначе рамка родителя
 * показывала бы «2 из 2», когда в ней на самом деле восемь.
 */
export function functionalMermaid(map: ProjectMap, visible: ReadonlySet<string> | null = null): MermaidOutput {
  const { capabilities, relations } = map.functional;
  if (capabilities.length === 0) return EMPTY;

  const summary = summarize(capabilities);
  const hints = relationHints(capabilities, relations, summary);
  const byId = new Map(capabilities.map((item) => [item.id, item]));
  const titleOf = (id: string) => byId.get(id)?.title ?? id;

  const details: Record<string, string> = {};
  const nodes: Record<string, MermaidNode> = {};
  const lines = ['flowchart LR'];
  for (const [state, { fill, stroke }] of Object.entries(STATE_FILL)) {
    lines.push(`    classDef cap_${state} fill:${fill},stroke:${stroke},color:#111827;`);
  }
  lines.push('    classDef cap_cycle stroke:#DC2626,stroke-width:3px,stroke-dasharray:4 2;');

  // Родитель, которого в списке нет, и круг из `parent` читаются как «верхний
  // уровень»: осиротевшая ветка не должна молча пропасть с диаграммы.
  const children = new Map<string, typeof capabilities>();
  for (const item of capabilities) {
    if (item.parent && item.parent !== item.id && byId.has(item.parent)) {
      children.set(item.parent, [...(children.get(item.parent) ?? []), item]);
    }
  }
  const roots = capabilities.filter((item) => !item.parent || item.parent === item.id || !byId.has(item.parent));

  const placed = new Set<string>();
  const styles: string[] = [];
  const cycleNodes: string[] = [];

  function describe(item: (typeof capabilities)[number], node: string): void {
    const own = summary.byId.get(item.id);
    const state = own?.state ?? 'unassessed';
    const hint = hints.byId.get(item.id);
    const waitsFor = (hint?.waitsFor ?? []).map(titleOf);
    details[node] = [
      item.id,
      item.title,
      `состояние: ${STATE_LABEL[state]}`,
      waitsFor.length ? `ждёт: ${waitsFor.join(', ')}` : '',
      hint?.inCycle ? 'зависит по кругу' : ''
    ].filter(Boolean).join(LF);
    nodes[node] = {
      id: item.id, title: item.title, summary: item.summary, declaredBy: item.declaredBy, pending: item.pending,
      capability: true,
      status: state === 'unassessed' ? undefined : state,
      note: item.note,
      progress: own && !own.leaf ? tallyText(own.tally) : undefined,
      relations: relationsOf(item.id, relations).map((entry) => ({ ...entry, otherTitle: byId.get(entry.other)?.title })),
      waitsFor: waitsFor.length ? waitsFor : undefined,
      inCycle: hint?.inCycle || undefined
    };
  }

  function render(item: (typeof capabilities)[number], depth: number): void {
    // Схема не требует уникальности id: два элемента с одним и тем же id в
    // разных ветках дерева нарисовали бы один узел дважды, с двух разных
    // мест сразу — mermaid запутается, какое определение верное.
    if (placed.has(item.id) || (visible && !visible.has(item.id))) return;
    placed.add(item.id);

    const node = nodeId('f', item.id);
    const pad = '    '.repeat(depth);
    const own = summary.byId.get(item.id);
    const state = own?.state ?? 'unassessed';
    const hint = hints.byId.get(item.id);
    describe(item, node);

    if (own && !own.leaf) {
      // Рамка вокруг подпунктов, на ней — счёт «5 из 8».
      lines.push(`${pad}subgraph ${node}["${label(item.title ?? item.id, 34)} · ${own.tally.implemented} из ${own.tally.total}"]`);
      for (const child of children.get(item.id) ?? []) render(child, depth + 1);
      lines.push(`${pad}end`);
      styles.push(`    style ${node} fill:none,stroke:${hint?.inCycle ? '#DC2626' : STATE_FILL[state].stroke},stroke-width:2px;`);
      return;
    }

    const waits = (hint?.waitsFor ?? []).map(titleOf);
    // «Ждёт» — второй строкой в самом узле: подсказка видна без клика.
    const wait = waits.length ? `<br/>ждёт: ${label(waits.join(', '), 30)}` : '';
    lines.push(`${pad}${node}["${label(item.title ?? item.id)}${wait}"]:::cap_${state}`);
    if (hint?.inCycle) cycleNodes.push(node);
  }

  for (const item of roots) render(item, 1);
  for (const item of capabilities) render(item, 1);

  const edges: MermaidEdge[] = [];
  const cycleLinks: number[] = [];
  for (const relation of relations) {
    if (relation.from === relation.to || !byId.has(relation.from) || !byId.has(relation.to)) continue;
    if (visible && (!visible.has(relation.from) || !visible.has(relation.to))) continue;
    const from = nodeId('f', relation.from);
    const to = nodeId('f', relation.to);
    const cycle = relation.kind === 'depends' && hints.cycleEdges.has(`${relation.from}>${relation.to}`);
    const text = relation.summary ? `|${edgeLabel(relation.summary)}|` : '';
    lines.push(`    ${from} ${RELATION_ARROW[relation.kind]}${text} ${to}`);
    if (cycle) cycleLinks.push(edges.length);
    edges.push({
      from, to, declaredBy: relation.declaredBy, pending: relation.pending,
      relation: { kind: relation.kind, summary: relation.summary, fromId: relation.from, toId: relation.to, cycle }
    });
  }

  lines.push(...styles);
  if (cycleNodes.length > 0) lines.push(`    class ${cycleNodes.join(',')} cap_cycle;`);
  for (const index of cycleLinks) lines.push(`    linkStyle ${index} stroke:#DC2626,stroke-width:2px;`);

  return { text: lines.join(LF), details, paths: {}, nodes, edges, neighbors: neighborsOf(edges) };
}
