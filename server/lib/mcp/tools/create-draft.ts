import { projectPath, requireOk, type McpTool } from '../index';

/** Только то, что потом подтверждает человек; карты заводит приложение своими путями. */
const TYPES = ['task', 'requirement', 'verification', 'decision', 'design'];

const tool: McpTool = {
  name: 'create_draft',
  description: 'Завести черновик записи. Номер выдаёт консоль. Подтверждает его только человек.',
  access: 'write',
  inputSchema: {
    type: 'object',
    required: ['type', 'title'],
    properties: {
      type: { type: 'string', enum: TYPES },
      title: { type: 'string' },
      body: { type: 'string', description: 'Текст. У задачи — с разделом «## Ожидаемый результат»' },
      links: { type: 'object', description: 'Связи: { "implements": ["R-0001"] }' }
    }
  },
  async run(args, ctx) {
    if (typeof args['type'] !== 'string' || !TYPES.includes(args['type'])) throw new Error(`Тип записи — один из: ${TYPES.join(', ')}`);
    const made = requireOk(await ctx.api.post(projectPath(ctx.projectId, '/records'), {
      type: args['type'], title: args['title'], body: args['body'], links: args['links'],
      ...(args['type'] === 'task' ? { change: 'feature' } : {})
    })) as { record?: { id?: string; status?: string }; id?: string };
    return `Заведена запись ${made.record?.id ?? made.id ?? ''}. Её подтверждает человек.`.replace('  ', ' ');
  }
};
export default tool;
