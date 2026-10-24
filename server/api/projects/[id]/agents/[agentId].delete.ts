import { defineEventHandler, getRouterParam } from 'h3';

import { deleteAgent } from '../../../../utils/agents-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Удалить агента — файл `docs/agents/<id>.md` (ADR-0033). История остаётся в git. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const agentId = getRouterParam(event, 'agentId') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(agentId)) return fail(event, 400, 'agent_id_invalid', 'Неверный id агента');
  return deleteAgent(project.root, agentId) ? { deleted: agentId } : fail(event, 404, 'agent_not_found', `Агента \`${agentId}\` нет`);
});
