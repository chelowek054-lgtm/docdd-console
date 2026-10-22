import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { agentText, parseAgent } from '../../../../lib/agents';
import { saveAgent } from '../../../../utils/agents-service';
import { fail } from '../../../../utils/http';
import { findProject } from '../../../../utils/projects';

/** Завести или изменить агента: `{ id, type, title, model?, access, prompt }` (ADR-0033). Право — `team`. */
export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id') ?? '';
  const project = await findProject(id);
  if (!project) return fail(event, 404, 'project_not_found', `Проект \`${id}\` не найден в списке`);
  const body = (await readBody<Record<string, unknown>>(event)) ?? {};
  const text = (value: unknown) => (typeof value === 'string' ? value : '');
  // Проверяем тем же разбором, что читает файл: сохранённое обязано читаться.
  const parsed = parseAgent(agentText({ id: text(body['id']).trim(), type: text(body['type']).trim(), title: text(body['title']).trim(), ...(text(body['model']).trim() ? { model: text(body['model']).trim() } : {}), access: text(body['access']) as never, prompt: text(body['prompt']) }));
  if (!parsed.ok) return fail(event, 400, 'agent_invalid', parsed.problem);
  if (!parsed.agent.prompt) return fail(event, 400, 'agent_prompt_required', 'У агента нет системного промпта');
  return { agent: parsed.agent, path: saveAgent(project.root, parsed.agent) };
});
