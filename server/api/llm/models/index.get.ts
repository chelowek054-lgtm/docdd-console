import { defineEventHandler } from 'h3';

import { listProviders } from '../../../lib/llm-provider';
import { fail } from '../../../utils/http';
import { syncProviders } from '../../../utils/llm-providers';
import { loadLlmSettings, toPublic } from '../../../utils/llm-settings';

/** Настройки моделей для экрана «Модели»: ключи не отдаются, только факт, что они найдены. */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { role?: unknown } }).user;
  if (user && user.role !== 'admin') return fail(event, 403, 'forbidden', 'Модели настраивает только администратор');
  await syncProviders();
  const settings = await loadLlmSettings();
  const registry = await Promise.all(listProviders().map(async (p) => ({ id: p.id, label: p.label, kind: p.kind, ...(await p.availability()) })));
  return { providers: settings.providers.map(toPublic), registry };
});
