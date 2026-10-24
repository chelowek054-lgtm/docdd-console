import { defineEventHandler, getRouterParam } from 'h3';

import { AGENT_TYPES, agentFromType } from '../../../../lib/agents';
import { listAgents, saveAgent } from '../../../../utils/agents-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** «Создать набор»: восемь агентов по умолчанию файлами; существующие не перезаписываются (ADR-0033). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const existing = new Set(listAgents(project.root).agents.map((agent) => agent.id));
  const created = AGENT_TYPES.filter((type) => !existing.has(type.type)).map((type) => saveAgent(project.root, agentFromType(type)));
  return { created };
});
