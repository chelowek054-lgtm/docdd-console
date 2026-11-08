import { budgetFrom, CONTEXT_BUDGET, cutToBudget, projectPath, requireOk, type McpTool } from '../index';

const tool: McpTool = {
  name: 'task_context',
  description: 'Пакет контекста задачи: сама задача с ожидаемым результатом, требование, связанные документы, вектор, карта кода и справочник. Читайте его вместо обхода папки docs.',
  access: 'read',
  inputSchema: { type: 'object', required: ['id'], properties: { id: { type: 'string', description: 'Например T-0183' }, budget: { type: 'number', description: 'Предел ответа в знаках' } } },
  async run(args, ctx) {
    const id = typeof args['id'] === 'string' ? args['id'] : '';
    if (!id) throw new Error('Не указан id задачи');
    // Закрытые куски (`confidential`) не запрашиваем: их видит только допущенный провайдер (ADR-0021).
    const pack = requireOk(await ctx.api.post(projectPath(ctx.projectId, '/context'), { centerId: id, need: 'task' })) as { prompt?: string };
    return cutToBudget(pack.prompt ?? '', budgetFrom(args, CONTEXT_BUDGET));
  }
};
export default tool;
