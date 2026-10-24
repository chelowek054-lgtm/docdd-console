import { defineEventHandler, readBody } from 'h3';

import { fail } from '../../utils/http';
import { loadLlmSettings, saveLlmSettings } from '../../utils/llm-settings';

/**
 * Выбрать, чем считать эмбеддинги: `{ provider: null }` — локально без сети,
 * `{ provider, model }` — OpenAI-совместимый провайдер и модель эмбеддингов.
 * Только администратор (при включённом входе). Смена модели пересоберёт индекс
 * при следующем поиске: векторы разных моделей несравнимы.
 */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { admin?: unknown } }).user;
  if (user && user.admin !== true) return fail(event, 403, 'forbidden', 'Поиск настраивает только администратор');
  const body = (await readBody(event)) as { provider?: unknown; model?: unknown } | null;
  const settings = await loadLlmSettings();
  const provider = typeof body?.provider === 'string' && body.provider ? body.provider : null;
  const model = typeof body?.model === 'string' ? body.model.trim() : '';
  if (provider) {
    const found = settings.providers.find((item) => item.id === provider);
    if (!found || found.type !== 'openai' || !found.baseUrl) return fail(event, 400, 'provider_unfit', 'Эмбеддинги умеет только OpenAI-совместимый провайдер с адресом');
    if (!model) return fail(event, 400, 'model_required', 'Укажите модель эмбеддингов');
  }
  const { embeddings: _old, ...rest } = settings;
  await saveLlmSettings(provider ? { ...rest, providers: settings.providers, embeddings: { provider, model } } : { ...rest, providers: settings.providers });
  return { ok: true };
});
