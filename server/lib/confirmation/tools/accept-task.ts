import { projectPath, requireOk, type McpTool } from '../../mcp';
import { confirmationBody, confirmationFromArgs, CONFIRM_PROPERTIES, CONFIRM_REQUIRED } from '../application/mcp-args';

/** Закрыть задачу на проверке после «да» человека (A-0008, R-0133). Ворота проверок действуют как на экране. */
const tool: McpTool = {
  name: 'accept_task',
  description: 'Принять задачу: перевести из «на проверке» (in_review) в «закрыта» (done) — ТОЛЬКО после явного «да» человека в чате. Не прошедшие проверки по-прежнему держат задачу: сначала accept_check для ручных.',
  access: 'write',
  inputSchema: { type: 'object', required: ['id', ...CONFIRM_REQUIRED], properties: { id: { type: 'string', description: 'Номер задачи' }, ...CONFIRM_PROPERTIES } },
  async run(args, ctx) {
    const confirmation = confirmationFromArgs(args);
    const id = typeof args['id'] === 'string' ? args['id'] : '';
    if (!id) throw new Error('Не назван номер задачи');
    if (!confirmation.question.includes(id)) throw new Error(`В вопросе человеку не назван ${id}`);
    const index = requireOk(await ctx.api.get(projectPath(ctx.projectId, '/index'))) as { records?: { id: string; type: string; status: string }[] };
    const record = index.records?.find((row) => row.id === id);
    if (!record) throw new Error(`Записи ${id} нет`);
    if (record.type !== 'task') throw new Error(`${id} — не задача: документы подтверждает approve_records`);
    if (record.status !== 'in_review') throw new Error(`${id} в статусе \`${record.status}\`: принимают только задачу на проверке`);
    requireOk(await ctx.api.post(projectPath(ctx.projectId, `/records/${encodeURIComponent(id)}/status`), { status: 'done', confirmation: confirmationBody(confirmation) }));
    return `${id}: in_review → done.`;
  }
};
export default tool;
