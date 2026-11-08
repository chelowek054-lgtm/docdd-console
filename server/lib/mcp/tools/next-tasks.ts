import { budgetFrom, cutToBudget, projectPath, requireOk, type McpTool } from '../index';

interface Row { id: string; type: string; title: string; status: string; links?: { depends_on?: string[] } }

const DONE = new Set(['done', 'dropped', 'legacy']);

const tool: McpTool = {
  name: 'next_tasks',
  description: 'Задачи, которые можно делать: уже в работе и готовые, у которых закрыты зависимости.',
  access: 'read',
  inputSchema: { type: 'object', properties: { budget: { type: 'number', description: 'Предел ответа в знаках' } } },
  async run(args, ctx) {
    const index = requireOk(await ctx.api.get(projectPath(ctx.projectId, '/index'))) as { records?: Row[] };
    const tasks = (index.records ?? []).filter((row) => row.type === 'task');
    const statusOf = new Map(tasks.map((row) => [row.id, row.status]));
    const free = (row: Row) => (row.links?.depends_on ?? []).every((id) => DONE.has(statusOf.get(id) ?? 'done'));
    const lines = [
      ...tasks.filter((row) => row.status === 'in_progress').map((row) => `${row.id} · в работе · ${row.title}`),
      ...tasks.filter((row) => row.status === 'ready' && free(row)).map((row) => `${row.id} · готова · ${row.title}`)
    ];
    return cutToBudget(lines.length ? lines.join('\n') : 'Задач, готовых к работе, нет.', budgetFrom(args));
  }
};
export default tool;
