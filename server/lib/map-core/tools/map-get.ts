import type { McpTool } from '../../mcp';
import { MAP_PROPERTY, mapName, readMap, targetOf } from '../application/mcp-maps';

/** Карта компактным текстом: модель видит узлы и связи, прежде чем их править (R-0142). */
const tool: McpTool = {
  name: 'map_get',
  description: 'Прочитать карту проекта: узлы (id, вид, имя, назначение, родитель, состояние) и связи. По умолчанию — стратегическая; пользовательская — по id из манифеста.',
  access: 'read',
  inputSchema: { type: 'object', properties: { ...MAP_PROPERTY } },
  async run(args, ctx) {
    const target = targetOf(args);
    const { nodes, edges } = await readMap(ctx, target);
    if (nodes.length === 0 && edges.length === 0) return `${mapName(target)}: пусто. Узлы — map_add_nodes, связи — map_connect.`;
    const lines = [`${mapName(target)}: узлов ${nodes.length}, связей ${edges.length}.`, '', 'Узлы:'];
    for (const node of nodes) {
      const tail = [node.parent ? `в ${node.parent}` : '', node.status ?? ''].filter(Boolean).join(', ');
      lines.push(`- ${node.id}${node.kind ? ` [${node.kind}]` : ''} «${node.title ?? ''}» — ${node.summary ?? 'без назначения'}${tail ? ` (${tail})` : ''}`);
    }
    if (edges.length > 0) {
      lines.push('', 'Связи:');
      for (const edge of edges) lines.push(`- ${edge.from} —${edge.type}→ ${edge.to}${edge.summary ? `: ${edge.summary}` : ''}`);
    }
    return lines.join('\n');
  }
};
export default tool;
