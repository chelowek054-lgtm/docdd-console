import type { MapStandard } from './standard';

/**
 * Линтер карт (A-0010, п. 7; R-0141): одна функция для интерфейса, MCP и проверки файлов.
 * Структурная беда — ошибка (запись не проходит), отступление от обозначений — предупреждение.
 * Каждая находка называет узел или связь, поле и строку, если её можно найти.
 */
export interface LintNode {
  id: string;
  kind?: string | undefined;
  title?: string | undefined;
  summary?: string | undefined;
  parent?: string | undefined;
}

export interface LintEdge {
  from: string;
  to: string;
  kind?: string | undefined;
  label?: string | undefined;
}

export interface LintFinding {
  severity: 'error' | 'warning';
  code: 'map_lint_field' | 'map_lint_node_kind' | 'map_lint_edge_kind' | 'map_lint_dangling' | 'map_lint_label' | 'map_lint_container';
  /** Узел (`id`) или связь (`from → to`). */
  target: string;
  field: string;
  line?: number;
  message: string;
}

export interface LintInput {
  /** Узлы, которые запись добавляет или меняет — уже сложенные с прежним состоянием узла. */
  nodes: readonly LintNode[];
  edges: readonly LintEdge[];
  /** Узлы, известные карте помимо записи: связь на них — не «в никуда». */
  known: ReadonlyMap<string, LintNode>;
  /** Текст записи: по нему ищется строка находки. */
  text?: string;
}

const blank = (value: string | undefined): boolean => !value || value.trim() === '';

/** Строка, где объявлен узел или начало связи; не нашлась — без строки. */
export function lineOf(text: string | undefined, needles: readonly string[]): number | undefined {
  if (!text) return undefined;
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex((line) => line.includes(needles[0] ?? ''));
  if (first < 0) return undefined;
  for (let at = first; at < lines.length; at++) {
    const window = lines.slice(at, at + 6).join('\n');
    if (needles.every((needle) => window.includes(needle))) return at + 1;
  }
  return first + 1;
}

export function lintGraph(input: LintInput, standard: MapStandard): LintFinding[] {
  const found: LintFinding[] = [];
  const nodeKinds = new Map(standard.nodeKinds.map((kind) => [kind.id, kind]));
  const edgeKinds = new Map(standard.edgeKinds.map((kind) => [kind.id, kind]));
  const own = new Map(input.nodes.map((node) => [node.id, node]));
  const has = (id: string) => own.has(id) || input.known.has(id);
  const nodeLine = (id: string) => lineOf(input.text, [`"id": "${id}"`]);
  const edgeLine = (edge: LintEdge) => lineOf(input.text, [`"from": "${edge.from}"`, `"to": "${edge.to}"`]);

  for (const node of input.nodes) {
    const at = nodeLine(node.id);
    const add = (code: LintFinding['code'], severity: LintFinding['severity'], field: string, message: string) =>
      found.push({ severity, code, target: node.id, field, ...(at ? { line: at } : {}), message });
    // Узел, уже стоящий на карте без имени или назначения, — долг прежних записей, а не этой:
    // предупреждение, чтобы отметка состояния на старой карте не упиралась в чужой пропуск.
    const missing = input.known.has(node.id) ? 'warning' : 'error';
    if (blank(node.title)) add('map_lint_field', missing, 'title', `Узел «${node.id}»: нет имени (title)`);
    if (blank(node.summary)) add('map_lint_field', missing, 'summary', `Узел «${node.id}»: не сказано назначение (summary) — зачем он на карте`);
    const kindId = node.kind ?? standard.defaultNodeKind;
    if (!kindId) add('map_lint_field', 'error', 'kind', `Узел «${node.id}»: не назван вид (kind); виды карты: ${[...nodeKinds.keys()].join(', ')}`);
    else if (!nodeKinds.has(kindId)) add('map_lint_node_kind', 'error', 'kind', `Узел «${node.id}»: вида «${kindId}» нет в стандарте карты «${standard.title}»; есть: ${[...nodeKinds.keys()].join(', ')}`);
    if (node.parent) {
      if (!has(node.parent)) add('map_lint_dangling', 'error', 'parent', `Узел «${node.id}»: родителя «${node.parent}» на карте нет`);
      else {
        const parent = own.get(node.parent) ?? input.known.get(node.parent);
        const parentKind = nodeKinds.get(parent?.kind ?? standard.defaultNodeKind ?? '');
        if (parentKind && parentKind.container === false) add('map_lint_container', 'warning', 'parent', `Узел «${node.id}» вложен в «${node.parent}» вида «${parentKind.title}», а этот вид по стандарту не группирует`);
      }
    }
  }

  for (const edge of input.edges) {
    const target = `${edge.from} → ${edge.to}`;
    const at = edgeLine(edge);
    const add = (code: LintFinding['code'], severity: LintFinding['severity'], field: string, message: string) =>
      found.push({ severity, code, target, field, ...(at ? { line: at } : {}), message });
    for (const [end, field] of [[edge.from, 'from'], [edge.to, 'to']] as const) {
      if (!has(end)) add('map_lint_dangling', 'error', field, `Связь ${target}: узла «${end}» на карте нет — связь в никуда`);
    }
    const kindId = edge.kind ?? standard.defaultEdgeKind;
    const kind = kindId ? edgeKinds.get(kindId) : undefined;
    if (!kindId) add('map_lint_field', 'error', 'kind', `Связь ${target}: не назван вид; виды карты: ${[...edgeKinds.keys()].join(', ')}`);
    else if (!kind) add('map_lint_edge_kind', 'error', 'kind', `Связь ${target}: вида «${kindId}» нет в стандарте карты «${standard.title}»; есть: ${[...edgeKinds.keys()].join(', ')}`);
    else if (kind.label !== 'optional' && blank(edge.label)) {
      add('map_lint_label', 'error', 'label', kind.label === 'format'
        ? `Связь ${target} («${kind.title}»): подпишите формат данных, например «JSON, заказ»`
        : `Связь ${target} («${kind.title}»): нужна подпись — что идёт по связи`);
    }
  }
  return found;
}

export const lintErrors = (findings: readonly LintFinding[]) => findings.filter((item) => item.severity === 'error');

/** Находки одной строкой каждая — для ответа API, MCP и вывода проверки. */
export const lintText = (findings: readonly LintFinding[]) =>
  findings.map((item) => `${item.severity === 'error' ? 'ошибка' : 'внимание'}${item.line ? `, строка ${item.line}` : ''}: ${item.message}`).join('\n');
