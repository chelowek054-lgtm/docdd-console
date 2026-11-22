import type { McpTool } from '../../mcp';
import { listArg, MAP_PROPERTY, mapName, NODE_SCHEMA, nodeOf, postDraft, readMap, targetOf, titleArg, type MapNode } from '../application/mcp-maps';

const KEEP = ['id', 'title', 'summary', 'parent', 'kind', 'status', 'note', 'priority', 'horizon'] as const;

/**
 * Правка узлов: названные поля поверх текущего состояния. Запись карты объявляет узел целиком —
 * последнее объявление побеждает, — поэтому инструмент сам дописывает то, что модель не меняла.
 */
const tool: McpTool = {
  name: 'map_update',
  description: 'Изменить узлы карты: имя, назначение, родителя, вид, состояние, заметку. Указываются id и только меняемые поля; остальное сохраняется. Черновик записи map, подтверждает человек.',
  access: 'write',
  inputSchema: {
    type: 'object',
    required: ['nodes'],
    properties: { ...MAP_PROPERTY, nodes: { type: 'array', items: NODE_SCHEMA }, title: { type: 'string', description: 'Название черновика' } }
  },
  async run(args, ctx) {
    const target = targetOf(args);
    const changes = listArg(args, 'nodes').map((item) => nodeOf(item, target));
    if (changes.length === 0) throw new Error('Не названо ни одного узла');
    const current = new Map((await readMap(ctx, target)).nodes.map((node) => [node.id, node]));
    const missing = changes.filter((node) => !current.has(node.id)).map((node) => node.id);
    if (missing.length > 0) throw new Error(`Нет на карте: ${missing.join(', ')} — новые узлы через map_add_nodes`);
    const nodes = changes.map((change) => {
      const before = current.get(change.id) as MapNode;
      const kept: Record<string, string> = {};
      for (const field of KEEP) {
        const value = before[field];
        if (typeof value === 'string' && value) kept[field] = value;
      }
      if (target.kind === 'custom') delete kept['kind'];
      return { ...kept, ...change } as MapNode;
    });
    return postDraft(ctx, target, titleArg(args, `Правка узлов: ${nodes.map((node) => node.id).join(', ')} — ${mapName(target)}`), { nodes });
  }
};
export default tool;
