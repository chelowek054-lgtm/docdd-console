import { projectPath, requireOk, type ToolContext } from '../../mcp';

import { blockText, type MapEdge, type MapNode, type MapPart, type MapTarget } from './map-block';

export { blockText, type MapEdge, type MapNode, type MapPart, type MapTarget } from './map-block';

/**
 * Общее у инструментов карт для MCP (R-0142): правка уходит черновиком записи `map` через
 * `POST …/map/draft` — тот же разбор, схема и линтер, что у ответа модели на экране. Подтверждает
 * черновик человек (A-0008); отказ линтера возвращается модели с узлом, полем и строкой.
 */


export const MAP_PROPERTY = {
  map: { type: 'string', description: 'Какая карта: strategic (стратегическая, по умолчанию) или id пользовательской карты из манифеста' }
} as const;

export const NODE_SCHEMA = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'string', description: 'Короткий id узла: латиница, точки, дефисы' },
    title: { type: 'string', description: 'Имя узла' },
    summary: { type: 'string', description: 'Назначение одной фразой: зачем узел на карте' },
    parent: { type: 'string', description: 'id родителя, если узел вложен' },
    kind: { type: 'string', description: 'Вид узла по стандарту карты (стратегическая: capability, system, person, external)' },
    status: { type: 'string', description: 'implemented, partial, not_implemented' },
    note: { type: 'string' }
  }
} as const;

export const EDGE_SCHEMA = {
  type: 'object',
  required: ['from', 'to', 'type'],
  properties: {
    from: { type: 'string' },
    to: { type: 'string' },
    type: { type: 'string', description: 'Вид связи: у стратегической depends, uses, feeds, triggers, replaces; у пользовательской — из её определения' },
    summary: { type: 'string', description: 'Подпись связи' }
  }
} as const;

const NODE_FIELDS = ['id', 'title', 'summary', 'parent', 'kind', 'status', 'note', 'priority', 'horizon'] as const;

export function targetOf(args: Record<string, unknown>): MapTarget {
  const map = typeof args['map'] === 'string' ? args['map'].trim() : '';
  if (!map || map === 'strategic' || map === 'functional') return { kind: 'strategic' };
  if (!/^[A-Za-z0-9-]+$/.test(map)) throw new Error(`Имя карты \`${map}\`: латиница, цифры и дефис`);
  return { kind: 'custom', id: map };
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/** Узел из аргументов: только известные поля и только строки — лишнее схема блока всё равно не пустит. */
export function nodeOf(raw: unknown, target: MapTarget): MapNode {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const node: Record<string, string> = {};
  for (const field of NODE_FIELDS) {
    if (target.kind === 'custom' && field === 'kind') continue; // у пользовательской карты вид узла один
    const value = text(item[field]);
    if (value) node[field] = value;
  }
  if (!node['id']) throw new Error('У узла нет id');
  return node as unknown as MapNode;
}

export function edgeOf(raw: unknown): MapEdge {
  const item = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const from = text(item['from']);
  const to = text(item['to']);
  const type = text(item['type']);
  if (!from || !to || !type) throw new Error('У связи нужны from, to и type');
  const summary = text(item['summary']);
  return { from, to, type, ...(summary ? { summary } : {}) };
}

export function listArg(args: Record<string, unknown>, name: string): unknown[] {
  const value = args[name];
  return Array.isArray(value) ? value : [];
}

/** Текущее состояние карты — из собранной консолью картины, с учётом всех подтверждённых записей. */
export async function readMap(ctx: ToolContext, target: MapTarget): Promise<{ nodes: MapNode[]; edges: MapEdge[] }> {
  if (target.kind === 'strategic') {
    const data = requireOk(await ctx.api.get(projectPath(ctx.projectId, '/map?kind=functional'))) as {
      functional?: { capabilities?: MapNode[]; relations?: MapEdge[] };
    };
    return { nodes: data.functional?.capabilities ?? [], edges: data.functional?.relations ?? [] };
  }
  // Определения карт — в манифесте; черновик на необъявленную карту линтеру судить не по чему.
  const data = requireOk(await ctx.api.get(projectPath(ctx.projectId, '/maps/custom'))) as {
    definitions?: { id: string }[];
    maps?: Record<string, { nodes?: MapNode[]; relations?: MapEdge[] }>;
  };
  const known = (data.definitions ?? []).map((item) => item.id);
  if (!known.includes(target.id)) {
    throw new Error(`Карты \`${target.id}\` нет среди определений манифеста. Есть: strategic${known.length ? `, ${known.join(', ')}` : ''}`);
  }
  const map = data.maps?.[target.id];
  return { nodes: map?.nodes ?? [], edges: map?.relations ?? [] };
}

/** Черновик записи карты через API. Отказ (схема, линтер) приходит текстом с местом каждой находки. */
export async function postDraft(ctx: ToolContext, target: MapTarget, title: string, added: MapPart, removed: MapPart = {}): Promise<string> {
  const answer = blockText(target, added, removed);
  const data = requireOk(await ctx.api.post(projectPath(ctx.projectId, '/map/draft'), { answer, title })) as {
    record?: { id?: string }; path?: string;
  };
  const id = data.record?.id ?? 'черновик';
  return `${id} — черновик карты${data.path ? ` (${data.path})` : ''}. На карту он встанет после подтверждения человеком: approve_records только после его «да».`;
}

export function titleArg(args: Record<string, unknown>, fallback: string): string {
  return text(args['title']) ?? fallback;
}

export function mapName(target: MapTarget): string {
  return target.kind === 'strategic' ? 'стратегическая карта' : `карта ${target.id}`;
}
