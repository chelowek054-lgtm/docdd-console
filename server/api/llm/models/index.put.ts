import { defineEventHandler, readBody } from 'h3';

import { parseRoutingTable } from '../../../lib/llm-routing';
import { fail } from '../../../utils/http';
import { syncProviders } from '../../../utils/llm-providers';
import { loadLlmSettings, saveLlmSettings, type ProviderSetting } from '../../../utils/llm-settings';

/**
 * Сохранить список провайдеров. Пришедшее без `apiKey` оставляет прежнее значение
 * ключа: браузер его не знает и не должен затирать.
 */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { role?: unknown } }).user;
  if (user && user.role !== 'admin') return fail(event, 403, 'forbidden', 'Модели настраивает только администратор');
  const body = (await readBody(event)) as { providers?: Array<Partial<ProviderSetting> & { hasKey?: boolean }> } | null;
  if (!body || !Array.isArray(body.providers)) return fail(event, 400, 'bad-request', 'Ожидался список providers');
  const current = await loadLlmSettings();
  const providers: ProviderSetting[] = [];
  for (const item of body.providers) {
    if (!item.id || !/^[\w:.-]+$/.test(item.id) || item.id === 'claude-code' || (item.type !== 'openai' && item.type !== 'anthropic') || !item.model) {
      return fail(event, 400, 'bad-request', 'У провайдера нужны уникальные id, type (openai | anthropic) и model');
    }
    const previous = current.providers.find((p) => p.id === item.id);
    const apiKey = typeof item.apiKey === 'string' && item.apiKey !== '' ? item.apiKey : previous?.apiKey;
    const { hasKey: _derived, ...rest } = item;
    providers.push({ ...(rest as ProviderSetting), ...(apiKey ? { apiKey } : {}) });
  }
  await saveLlmSettings({ ...current, providers, ...((body as { routes?: unknown }).routes !== undefined ? { routes: parseRoutingTable((body as { routes?: unknown }).routes) } : {}) });
  await syncProviders();
  return { ok: true };
});
