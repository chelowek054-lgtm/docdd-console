import { defineEventHandler, getRouterParam, setHeader } from 'h3';

import { listProviders } from '../../../../lib/llm-provider';
import { parseRoutingTable } from '../../../../lib/llm-routing';
import { fail } from '../../../../utils/http';
import { syncProviders } from '../../../../utils/llm-providers';
import { loadLlmSettings } from '../../../../utils/llm-settings';
import { findProject } from '../../../../utils/projects';
import { verifiedChatModels } from '../../../../lib/project-chat/models';

export default defineEventHandler(async (event) => {
  const project = await findProject(getRouterParam(event, 'id') ?? '');
  if (!project) return fail(event, 404, 'project_not_found', 'Проект не найден');
  setHeader(event, 'Cache-Control', 'no-store');
  await syncProviders();
  const settings = await loadLlmSettings();
  const configured = new Map(settings.providers.map((item) => [item.id, item]));
  const route = parseRoutingTable(settings.routes).ask;
  const models = await Promise.all(listProviders().map(async (item) => ({
    id: item.id, label: item.label, kind: item.kind,
    available: (await item.availability()).available,
    model: (route?.providerId === item.id ? route.model : undefined) ?? configured.get(item.id)?.model
  })));
  const verified = new Set(verifiedChatModels(settings));
  const hidden = new Set(Array.isArray(settings.chatHidden) ? settings.chatHidden : []);
  return { models: models.filter((item) => item.available && verified.has(item.id) && !hidden.has(item.id)), defaultId: route?.providerId };
});
