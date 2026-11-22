import { projectPath, requireOk, type McpTool } from '../../mcp';
import { confirmationBody, confirmationFromArgs, CONFIRM_PROPERTIES, CONFIRM_REQUIRED } from '../application/mcp-args';

/** Ручная приёмка проверки за человека, который проверил сам и сказал «да» (A-0008, ADR-0029). */
const tool: McpTool = {
  name: 'accept_check',
  description: 'Отметить проверку пройденной вручную («Проверено») — ТОЛЬКО если человек сам проверил и в чате подтвердил. note — что именно он проверил, его словами.',
  access: 'write',
  inputSchema: {
    type: 'object',
    required: ['id', 'note', ...CONFIRM_REQUIRED],
    properties: { id: { type: 'string', description: 'Номер проверки (V-…)' }, note: { type: 'string', description: 'Что проверено, до 300 знаков' }, ...CONFIRM_PROPERTIES }
  },
  async run(args, ctx) {
    const confirmation = confirmationFromArgs(args);
    const id = typeof args['id'] === 'string' ? args['id'] : '';
    const note = typeof args['note'] === 'string' ? args['note'].trim() : '';
    if (!id) throw new Error('Не назван номер проверки');
    if (!note) throw new Error('Не сказано, что проверено: передайте слова человека в note');
    if (!confirmation.question.includes(id)) throw new Error(`В вопросе человеку не назван ${id}`);
    requireOk(await ctx.api.post(projectPath(ctx.projectId, `/records/${encodeURIComponent(id)}/verified`), { verified: true, by: confirmation.by, note, confirmation: confirmationBody(confirmation) }));
    return `${id}: проверено вручную · ${confirmation.by}.`;
  }
};
export default tool;
