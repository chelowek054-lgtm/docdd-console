import type { McpTool } from '../../mcp';
import { postMapAnswer, titleArg } from '../application/mcp-maps';

const tool: McpTool = {
  name: 'map_apply',
  description: 'Создать черновик из блоков docdd карт. Передайте contextToken из map_get для каждого затронутого вида. Линтер проверяет правку, человек её подтверждает.',
  access: 'write',
  inputSchema: {
    type: 'object',
    required: ['answer', 'contextTokens'],
    properties: {
      answer: { type: 'string', description: 'Текст с блоками карты по схемам из map_get' },
      contextTokens: { type: 'array', items: { type: 'string' }, minItems: 1 },
      title: { type: 'string' }
    }
  },
  async run(args, ctx) {
    if (typeof args['answer'] !== 'string' || !args['answer'].trim()) throw new Error('Нужен текст правки карты');
    const tokens = Array.isArray(args['contextTokens']) ? args['contextTokens'].filter((item): item is string => typeof item === 'string') : [];
    if (!tokens.length) throw new Error('Сначала получите contextToken через map_get для каждой карты');
    return postMapAnswer(ctx, args['answer'], tokens, titleArg(args, 'Правка карты'));
  }
};
export default tool;
