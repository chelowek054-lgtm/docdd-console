import { projectPath, requireOk, type McpTool } from '../../mcp';
import { confirmationBody, confirmationFromArgs, CONFIRM_PROPERTIES, CONFIRM_REQUIRED } from '../application/mcp-args';

const LIMIT = 20;

/** Подтверждение записей после «да» человека (A-0008, R-0133). Задачи закрывает `accept_task`. */
const tool: McpTool = {
  name: 'approve_records',
  description: 'Подтвердить записи (требования, решения, карты, проверки и другие документы) — ТОЛЬКО после того, как вы спросили человека в чате и он явно ответил «да». В вопросе перечислите записи. Вопрос и ответ попадут в журнал каждой записи.',
  access: 'write',
  inputSchema: {
    type: 'object',
    required: ['ids', ...CONFIRM_REQUIRED],
    properties: { ids: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: LIMIT, description: 'Номера записей' }, ...CONFIRM_PROPERTIES }
  },
  async run(args, ctx) {
    const confirmation = confirmationFromArgs(args);
    const ids = Array.isArray(args['ids']) ? (args['ids'] as unknown[]).filter((id): id is string => typeof id === 'string' && id !== '') : [];
    if (ids.length === 0) throw new Error('Не названы записи: нужен непустой список ids');
    if (ids.length > LIMIT) throw new Error(`За раз — не больше ${LIMIT} записей`);
    const missing = ids.filter((id) => !confirmation.question.includes(id));
    if (missing.length > 0) throw new Error(`В вопросе человеку не названы ${missing.join(', ')}: подтверждать можно только то, о чём спросили`);
    const lines: string[] = [];
    for (const id of ids) {
      const answer = await ctx.api.post(projectPath(ctx.projectId, `/records/${encodeURIComponent(id)}/status`), { status: 'approved', confirmation: confirmationBody(confirmation) });
      try {
        requireOk(answer);
        lines.push(`${id}: подтверждена`);
      } catch (error) {
        lines.push(`${id}: ${(error as Error).message}`);
      }
    }
    return lines.join('\n');
  }
};
export default tool;
