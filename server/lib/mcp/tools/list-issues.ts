import { budgetFrom, cutToBudget, projectPath, requireOk, type McpTool } from '../index';

interface Issue { code?: string; severity?: string; recordId?: string | null; record?: string | null; message?: string }

const tool: McpTool = {
  name: 'list_issues',
  description: 'Нарушения правил DocDD: сначала ошибки. Можно сузить до одной записи.',
  access: 'read',
  inputSchema: { type: 'object', properties: { id: { type: 'string', description: 'Только эта запись' }, budget: { type: 'number', description: 'Предел ответа в знаках' } } },
  async run(args, ctx) {
    const answer = requireOk(await ctx.api.get(projectPath(ctx.projectId, '/issues'))) as { issues?: Issue[] };
    const only = typeof args['id'] === 'string' ? args['id'] : '';
    const owner = (item: Issue) => item.recordId ?? item.record ?? '';
    const issues = (answer.issues ?? [])
      .filter((item) => !only || owner(item) === only)
      .sort((a, b) => Number(b.severity === 'error') - Number(a.severity === 'error'));
    const lines = issues.map((item) => `${item.severity ?? '?'} · ${item.code ?? '?'}${owner(item) ? ` · ${owner(item)}` : ''} · ${item.message ?? ''}`);
    return cutToBudget(lines.length ? lines.join('\n') : 'Нарушений нет.', budgetFrom(args));
  }
};
export default tool;
