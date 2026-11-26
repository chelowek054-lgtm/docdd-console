import { defineEventHandler } from 'h3';

import { listProviders } from '../../../lib/llm-provider';
import { fail } from '../../../utils/http';
import { codexProvider } from '../../../utils/llm-agents';
import { syncProviders } from '../../../utils/llm-providers';
import { loadLlmSettings, toPublic } from '../../../utils/llm-settings';
import { verifiedChatModels } from '../../../lib/project-chat/models';

/** Настройки моделей для экрана «Модели»: ключи не отдаются, только факт, что они найдены. */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { admin?: unknown } }).user;
  if (user && user.admin !== true) return fail(event, 403, 'forbidden', 'Модели настраивает только администратор');
  await syncProviders();
  const settings = await loadLlmSettings();
  const configured = listProviders();
  const candidates = configured.some((provider) => provider.id === 'codex-cli') ? configured : [...configured, codexProvider()];
  const registry = await Promise.all(candidates.map(async (p) => ({ id: p.id, label: p.label, kind: p.kind, ...(await p.availability()) })));
  return { providers: settings.providers.map(toPublic), registry, routes: settings.routes ?? {}, agents: settings.agents ?? [],
    verified: verifiedChatModels(settings), chatHidden: settings.chatHidden ?? [] };
});
