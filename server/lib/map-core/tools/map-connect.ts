import type { McpTool } from '../../mcp';
import { EDGE_SCHEMA, edgeOf, listArg, MAP_PROPERTY, mapName, postDraft, readMap, targetOf, titleArg } from '../application/mcp-maps';

/** Связи — черновиком записи карты; связь на узел, которого нет, линтер вернёт с узлом и полем. */
const tool: McpTool = {
  name: 'map_connect',
  description: 'Связать узлы карты: from, to, вид связи (type) и подпись (summary). Связь в никуда — отказ линтера с местом. Черновик записи map, подтверждает человек.',
  access: 'write',
  inputSchema: {
    type: 'object',
    required: ['relations'],
    properties: { ...MAP_PROPERTY, relations: { type: 'array', items: EDGE_SCHEMA }, title: { type: 'string', description: 'Название черновика' } }
  },
  async run(args, ctx) {
    const target = targetOf(args);
    const edges = listArg(args, 'relations').map(edgeOf);
    if (edges.length === 0) throw new Error('Не названо ни одной связи');
    await readMap(ctx, target); // пользовательская карта должна быть объявлена
    return postDraft(ctx, target, titleArg(args, `Связи: ${edges.map((edge) => `${edge.from}→${edge.to}`).join(', ')} — ${mapName(target)}`), { edges });
  }
};
export default tool;
