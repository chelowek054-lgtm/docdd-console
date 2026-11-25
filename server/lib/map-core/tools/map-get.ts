import { projectPath, requireOk, type McpTool } from '../../mcp';
import { MAP_PROPERTY } from '../application/mcp-maps';

const builtin = new Set(['strategic', 'strategy', 'functional', 'domain', 'sysdesign', 'codemap', 'code', 'codebase', 'dataflow', 'userflow']);

const tool: McpTool = {
  name: 'map_get',
  description: 'Прочитать цель, правила, схему, легенду, состояние и contextToken карты. Перед правкой сначала вызовите этот инструмент.',
  access: 'read',
  inputSchema: {
    type: 'object',
    properties: {
      ...MAP_PROPERTY,
      group: { type: 'string', description: 'ID группы для чтения её части карты' },
      offset: { type: 'integer', minimum: 0 },
      limit: { type: 'integer', minimum: 1, maximum: 200 }
    }
  },
  async run(args, ctx) {
    const name = typeof args['map'] === 'string' ? args['map'].trim() : '';
    const map = !name ? 'functional' : builtin.has(name) || name.startsWith('custom:') ? name : 'custom:' + name;
    const query = new URLSearchParams({ map });
    for (const key of ['offset', 'limit', 'group']) {
      const value = args[key];
      if (typeof value === 'string' || typeof value === 'number') query.set(key, String(value));
    }
    return JSON.stringify(requireOk(await ctx.api.get(projectPath(ctx.projectId, '/map/context?' + query))), null, 2);
  }
};
export default tool;
