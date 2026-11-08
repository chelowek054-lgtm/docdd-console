import { projectPath, requireOk, type McpTool } from '../index';

const tool: McpTool = {
  name: 'add_journal_line',
  description: 'Добавить заметку в журнал записи. Текст документа это не меняет и статус не двигает.',
  access: 'write',
  inputSchema: { type: 'object', required: ['id', 'text'], properties: { id: { type: 'string' }, text: { type: 'string', description: 'Одна строка, до 500 знаков' } } },
  async run(args, ctx) {
    const id = typeof args['id'] === 'string' ? args['id'] : '';
    if (!id) throw new Error('Не указан id записи');
    requireOk(await ctx.api.post(projectPath(ctx.projectId, `/records/${encodeURIComponent(id)}/journal`), { text: args['text'] }));
    return `Заметка добавлена в журнал ${id}.`;
  }
};
export default tool;
