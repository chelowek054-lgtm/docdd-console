import type { McpTool } from '../../mcp';
import { EDGE_SCHEMA, edgeOf, listArg, MAP_PROPERTY, mapName, postDraft, readMap, targetOf, titleArg } from '../application/mcp-maps';

/**
 * Удаление узлов и связей — разделом `removed` записи карты. Связи удаляемого узла уходят вместе с ним:
 * иначе на карте остались бы связи в никуда.
 */
const tool: McpTool = {
  name: 'map_remove',
  description: 'Убрать с карты узлы (по id) и связи (from, to, type). Связи убираемых узлов уходят вместе с ними. Черновик записи map, подтверждает человек.',
  access: 'write',
  inputSchema: {
    type: 'object',
    properties: {
      ...MAP_PROPERTY,
      nodes: { type: 'array', items: { type: 'string' }, description: 'id узлов' },
      relations: { type: 'array', items: EDGE_SCHEMA },
      title: { type: 'string', description: 'Название черновика' }
    }
  },
  async run(args, ctx) {
    const target = targetOf(args);
    const ids = listArg(args, 'nodes').filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim());
    const named = listArg(args, 'relations').map(edgeOf);
    if (ids.length === 0 && named.length === 0) throw new Error('Не названо, что убрать');
    const current = await readMap(ctx, target);
    const known = new Set(current.nodes.map((node) => node.id));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length > 0) throw new Error(`Нет на карте: ${missing.join(', ')}`);
    const gone = new Set(ids);
    const key = (edge: { from: string; to: string; type: string }) => `${edge.from}>${edge.to}:${edge.type}`;
    const edges = new Map(named.map((edge) => [key(edge), { from: edge.from, to: edge.to, type: edge.type }]));
    for (const edge of current.edges) if (gone.has(edge.from) || gone.has(edge.to)) edges.set(key(edge), { from: edge.from, to: edge.to, type: edge.type });
    const nodes = ids.map((id) => ({ id }));
    return postDraft(ctx, target, titleArg(args, `Убрать: ${[...ids, ...named.map((edge) => `${edge.from}→${edge.to}`)].join(', ')} — ${mapName(target)}`), {}, { nodes, edges: [...edges.values()] });
  }
};
export default tool;
