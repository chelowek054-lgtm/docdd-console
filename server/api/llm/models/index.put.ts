import { defineEventHandler, readBody } from 'h3';

import { parseRoutingTable } from '../../../lib/llm-routing';
import { duplicateId } from '../../../lib/llm-provider';
import { fail } from '../../../utils/http';
import { apiProvider, probeProvider, syncProviders } from '../../../utils/llm-providers';
import { claudeCodeProvider } from '../../../utils/llm-claude';
import { codexProvider, geminiProvider } from '../../../utils/llm-agents';
import { loadLlmSettings, saveLlmSettings, type LlmSettings, type ProviderSetting } from '../../../utils/llm-settings';
import { modelRevision } from '../../../lib/project-chat/models';

/**
 * Сохранить список провайдеров. Пришедшее без `apiKey` оставляет прежнее значение
 * ключа: браузер его не знает и не должен затирать.
 */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { admin?: unknown } }).user;
  if (user && user.admin !== true) return fail(event, 403, 'forbidden', 'Модели настраивает только администратор');
  const body = (await readBody(event)) as { providers?: Array<Partial<ProviderSetting> & { hasKey?: boolean }>; agents?: unknown; routes?: unknown; verifyChat?: boolean; verifyProviderId?: unknown; chatHidden?: unknown } | null;
  if (!body || !Array.isArray(body.providers)) return fail(event, 400, 'bad-request', 'Ожидался список providers');
  const current = await loadLlmSettings();
  const providers: ProviderSetting[] = [];
  const dup = duplicateId(body.providers);
  if (dup) return fail(event, 400, 'provider_duplicate', `Провайдер «${dup}» назван дважды: id должны быть уникальны`);
  for (const item of body.providers) {
    if (!item.id || !/^[\w:.-]+$/.test(item.id) || item.id === 'claude-code' || (item.type !== 'openai' && item.type !== 'anthropic') || !item.model) {
      return fail(event, 400, 'bad-request', 'У провайдера нужны уникальные id, type (openai | anthropic) и model');
    }
    const previous = current.providers.find((p) => p.id === item.id);
    // Пустой apiKey оставляет прежний ключ; стереть его можно только явным clearKey: true.
    const apiKey = (item as { clearKey?: unknown }).clearKey === true ? undefined : typeof item.apiKey === 'string' && item.apiKey !== '' ? item.apiKey : previous?.apiKey;
    const { hasKey: _derived, clearKey: _clear, apiKey: _typed, ...rest } = item as typeof item & { clearKey?: unknown };
    providers.push({ ...(rest as ProviderSetting), ...(apiKey ? { apiKey } : {}) });
  }
  const agents = body.agents;
  if (agents !== undefined && (!Array.isArray(agents) || agents.some((id) => id !== 'codex-cli' && id !== 'gemini-cli'))) {
    return fail(event, 400, 'bad-request', 'Неизвестный CLI-агент');
  }
  const routes = parseRoutingTable(body.routes ?? current.routes);
  const next: LlmSettings = {
    ...current, providers, ...(body.routes !== undefined ? { routes } : {}),
    ...(Array.isArray(agents) ? { agents: [...new Set(agents)] } : {}),
    ...(Array.isArray(body.chatHidden) ? { chatHidden: body.chatHidden.filter((id): id is string => typeof id === 'string') } : {})
  };
  let verification;
  const providerId = typeof body.verifyProviderId === 'string' ? body.verifyProviderId : body.verifyChat === true ? routes.ask?.providerId : undefined;
  if (providerId) {
    const model = routes.ask?.providerId === providerId ? routes.ask.model : undefined;
    const setting = providers.find((item) => item.id === providerId && item.enabled !== false);
    const enabledAgents = Array.isArray(agents) ? agents : (Array.isArray(current.agents) ? current.agents : []);
    const cli = providerId === 'claude-code' ? claudeCodeProvider : [
      { id: 'codex-cli', create: codexProvider },
      { id: 'gemini-cli', create: geminiProvider }
    ].find(({ id }) => id === providerId && enabledAgents.includes(id))?.create();
    const provider = cli ?? (setting ? apiProvider(setting) : undefined);
    verification = provider ? await probeProvider(provider, model) : { ok: false as const, failure: { code: 'unavailable' } };
    if (!verification.ok) return { ok: false, verification };
    if (JSON.stringify(await loadLlmSettings()) !== JSON.stringify(current)) {
      return fail(event, 409, 'conflict', 'Настройки моделей изменились во время проверки. Обновите страницу и повторите.');
    }
    next.chatVerified = { ...(current.chatVerified as Record<string, unknown> | undefined), [providerId]: modelRevision(next, providerId) };
  }
  await saveLlmSettings(next);
  await syncProviders();
  return { ok: true, ...(verification ? { verification } : {}) };
});
