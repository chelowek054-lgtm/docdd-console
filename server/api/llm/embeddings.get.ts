import { defineEventHandler } from 'h3';

import { LOCAL_MODEL } from '../../lib/semantic';
import { loadLlmSettings } from '../../utils/llm-settings';

/**
 * Чем считаются эмбеддинги смыслового поиска (окно «Настройки» → «Поиск»,
 * docs/adr/0031-semantic-search.md): выбранный провайдер и модель и список
 * провайдеров, которые это умеют (OpenAI-совместимые). Ключи наружу не идут.
 */
export default defineEventHandler(async () => {
  const settings = await loadLlmSettings();
  const chosen = settings['embeddings'] as { provider?: string; model?: string } | undefined;
  return {
    provider: chosen?.provider ?? null,
    model: chosen?.model ?? null,
    local: LOCAL_MODEL,
    candidates: settings.providers
      .filter((provider) => provider.type === 'openai' && provider.baseUrl && provider.enabled !== false)
      .map((provider) => ({ id: provider.id, label: provider.label ?? provider.id, closedData: provider.closedData === true }))
  };
});
