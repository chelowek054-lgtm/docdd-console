import type { McpTool } from '../../mcp';
import { listArg, MAP_PROPERTY, mapName, NODE_SCHEMA, nodeOf, postDraft, readMap, targetOf, titleArg } from '../application/mcp-maps';

/** Новые узлы — черновиком записи карты; уже стоящий узел правит map_update, чтобы не затереть его поля. */
const tool: McpTool = {
  name: 'map_add_nodes',
  description: 'Добавить узлы на карту черновиком записи map. У каждого узла — id, title и summary (назначение); без них линтер откажет и назовёт узел и поле. Встанут на карту после подтверждения человеком.',
  access: 'write',
  inputSchema: {
    type: 'object',
    required: ['nodes'],
    properties: { ...MAP_PROPERTY, nodes: { type: 'array', items: NODE_SCHEMA }, title: { type: 'string', description: 'Название черновика' } }
  },
  async run(args, ctx) {
    const target = targetOf(args);
    const nodes = listArg(args, 'nodes').map((item) => nodeOf(item, target));
    if (nodes.length === 0) throw new Error('Не названо ни одного узла');
    const current = new Set((await readMap(ctx, target)).nodes.map((node) => node.id));
    const taken = nodes.filter((node) => current.has(node.id)).map((node) => node.id);
    if (taken.length > 0) throw new Error(`Уже на карте: ${taken.join(', ')} — правка через map_update`);
    return postDraft(ctx, target, titleArg(args, `Узлы: ${nodes.map((node) => node.id).join(', ')} — ${mapName(target)}`), { nodes });
  }
};
export default tool;
