import { defineEventHandler, getRouterParam, readBody } from 'h3';

import { getProvider } from '../../../../lib/llm-provider';
import { parseRoutingTable } from '../../../../lib/llm-routing';
import { fail } from '../../../../utils/http';
import { probeProvider, syncProviders } from '../../../../utils/llm-providers';
import { loadLlmSettings } from '../../../../utils/llm-settings';
import { sharedDenied } from '../../../../utils/mode';
import { findProject } from '../../../../utils/projects';

export default defineEventHandler(async (event) => {
  const denied = sharedDenied(event, 'Проверка подключения модели');
  if (denied) return denied;
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  const body = await readBody<{ id?: unknown }>(event);
  await syncProviders();
  const provider = typeof body?.id === 'string' ? getProvider(body.id) : undefined;
  if (!provider || !(await provider.availability()).available) return { ok: false };
  const route = parseRoutingTable((await loadLlmSettings()).routes).ask;
  return probeProvider(provider, route?.providerId === provider.id ? route.model : undefined, 96);
});
