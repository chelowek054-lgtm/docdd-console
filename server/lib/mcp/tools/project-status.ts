import { budgetFrom, cutToBudget, projectPath, requireOk, type McpTool } from '../index';

interface Row { type: string; status: string }

const tool: McpTool = {
  name: 'project_status',
  description: 'Сводка проекта DocDD: число записей по типам и статусам, ошибки и предупреждения. Начинайте работу с неё.',
  access: 'read',
  inputSchema: { type: 'object', properties: { budget: { type: 'number', description: 'Предел ответа в знаках' } } },
  async run(args, ctx) {
    const index = requireOk(await ctx.api.get(projectPath(ctx.projectId, '/index'))) as { records?: Row[]; issues?: { severity?: string }[] };
    const counts = new Map<string, number>();
    for (const row of index.records ?? []) counts.set(`${row.type} · ${row.status}`, (counts.get(`${row.type} · ${row.status}`) ?? 0) + 1);
    const issues = index.issues ?? [];
    const errors = issues.filter((item) => item.severity === 'error').length;
    const lines = [`Записей: ${index.records?.length ?? 0}. Ошибок: ${errors}. Предупреждений: ${issues.length - errors}.`, ...[...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, count]) => `${key}: ${count}`)];
    return cutToBudget(lines.join('\n'), budgetFrom(args));
  }
};
export default tool;
