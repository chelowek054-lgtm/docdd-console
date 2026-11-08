import { projectPath, requireOk, type McpTool } from '../index';

/** Белый список (A-0002): закрыть задачу, подтвердить запись или вернуть статус через MCP нечем. */
const ALLOWED: Readonly<Record<string, string>> = { in_progress: 'ready', in_review: 'in_progress' };

const tool: McpTool = {
  name: 'move_task',
  description: 'Взять задачу в работу (ready → in_progress) или сдать на проверку (in_progress → in_review). Других переходов нет: закрывает задачу человек.',
  access: 'write',
  inputSchema: { type: 'object', required: ['id', 'to'], properties: { id: { type: 'string' }, to: { type: 'string', enum: Object.keys(ALLOWED) } } },
  async run(args, ctx) {
    const id = typeof args['id'] === 'string' ? args['id'] : '';
    const to = typeof args['to'] === 'string' ? args['to'] : '';
    const from = ALLOWED[to];
    if (!id || !from) throw new Error(`Переход в \`${to}\` через MCP недоступен: только ${Object.keys(ALLOWED).join(', ')}`);
    const index = requireOk(await ctx.api.get(projectPath(ctx.projectId, '/index'))) as { records?: { id: string; type: string; status: string }[] };
    const record = index.records?.find((row) => row.id === id);
    if (!record) throw new Error(`Записи ${id} нет`);
    if (record.type !== 'task') throw new Error(`${id} — не задача`);
    if (record.status !== from) throw new Error(`${id} в статусе \`${record.status}\`: в \`${to}\` переходят только из \`${from}\``);
    requireOk(await ctx.api.post(projectPath(ctx.projectId, `/records/${encodeURIComponent(id)}/status`), { status: to }));
    return `${id}: ${from} → ${to}.`;
  }
};
export default tool;
