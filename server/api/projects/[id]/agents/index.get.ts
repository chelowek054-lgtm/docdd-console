import { defineEventHandler, getRouterParam } from 'h3';

import { AGENT_ACCESS, AGENT_TYPES } from '../../../../lib/agents';
import { listAgents } from '../../../../utils/agents-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Агенты проекта и набор типов по умолчанию (ADR-0033). */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  return { ...listAgents(project.root), types: AGENT_TYPES, access: AGENT_ACCESS };
});
