import type { ProjectMap } from '../../server/lib/maps';

/**
 * Карты в текст mermaid. Тот же текст показывается на экране и выгружается,
 * чтобы вставить его в документ проекта и перерисовывать в его сборке
 * (docs/07-maps.md).
 */

const LF = String.fromCharCode(10);

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
function declareImplicit(lines: string[], prefix: string, declared: ReadonlySet<string>, used: readonly string[]): void {
  for (const id of [...new Set(used)]) {
    if (declared.has(id)) continue;
    lines.push(`    ${nodeId(prefix, id)}["${label(id)}"]`);
  }
}

export function codemapMermaid(map: ProjectMap): string {
  const { modules, imports } = map.codemap;
  if (modules.length === 0 && imports.length === 0) return '';

  const lines = ['flowchart LR'];
  // Слои становятся подграфами: колонка на слой читается лучше клубка.
  const layers = new Map<string, typeof modules>();
  for (const module of modules) {
    const layer = module.layer ?? 'без слоя';
    layers.set(layer, [...(layers.get(layer) ?? []), module]);
  }

  for (const [layer, items] of layers) {
    lines.push(`    subgraph ${nodeId('layer', layer)}["${label(layer)}"]`);
    for (const module of items) {
      lines.push(`        ${nodeId('m', module.id)}["${label(module.title ?? module.id)}"]`);
    }
    lines.push('    end');
  }

  declareImplicit(
    lines,
    'm',
    new Set(modules.map((module) => module.id)),
    imports.flatMap((edge) => [edge.from, edge.to])
  );

  for (const edge of imports) {
    lines.push(`    ${nodeId('m', edge.from)} --> ${nodeId('m', edge.to)}`);
  }
  return lines.join(LF);
}

export function dataflowMermaid(map: ProjectMap): string {
  const { sources, flows } = map.dataflow;
  if (sources.length === 0 && flows.length === 0) return '';

  const lines = ['flowchart LR'];
  for (const source of sources) {
    // Хранилище рисуется цилиндром, остальное — прямоугольником: вид источника
    // должен читаться без легенды.
    const shape = source.kind === 'db' || source.kind === 'file'
      ? `[("${label(source.title ?? source.id)}")]`
      : `["${label(source.title ?? source.id)}"]`;
    lines.push(`    ${nodeId('s', source.id)}${shape}`);
  }

  declareImplicit(lines, 's', new Set(sources.map((source) => source.id)), flows.map((flow) => flow.to));
  for (const name of [...new Set(flows.map((flow) => flow.from))]) {
    lines.push(`    ${nodeId('f', name)}["${label(name)}"]`);
  }

  for (const flow of flows) {
    // Чтение рисуется стрелкой от источника: направление данных, а не вызова.
    const arrow = flow.direction === 'both' ? '<-->' : '-->';
    const from = flow.direction === 'read' ? nodeId('s', flow.to) : nodeId('f', flow.from);
    const to = flow.direction === 'read' ? nodeId('f', flow.from) : nodeId('s', flow.to);
    lines.push(`    ${from} ${arrow}|${flow.direction}| ${to}`);
  }
  return lines.join(LF);
}

export function userflowMermaid(map: ProjectMap): string {
  const { screens, transitions, calls } = map.userflow;
  if (screens.length === 0 && transitions.length === 0 && calls.length === 0) return '';

  const lines = ['flowchart TD'];
  for (const screen of screens) {
    lines.push(`    ${nodeId('u', screen.id)}["${label(screen.title ?? screen.id)}"]`);
  }
  declareImplicit(
    lines,
    'u',
    new Set(screens.map((screen) => screen.id)),
    [...transitions.flatMap((step) => [step.from, step.to]), ...calls.map((call) => call.from)]
  );

  for (const step of transitions) {
    const via = step.trigger ? `|${label(step.trigger, 24)}|` : '';
    lines.push(`    ${nodeId('u', step.from)} -->${via} ${nodeId('u', step.to)}`);
  }
  for (const call of calls) {
    lines.push(`    ${nodeId('api', call.to)}(["${label(call.to)}"])`);
    lines.push(`    ${nodeId('u', call.from)} -.-> ${nodeId('api', call.to)}`);
  }
  return lines.join(LF);
}
