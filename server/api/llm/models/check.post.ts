import { defineEventHandler, readBody } from 'h3';

import { getProvider } from '../../../lib/llm-provider';
import { fail } from '../../../utils/http';
import { syncProviders } from '../../../utils/llm-providers';

/** Проверка связи: короткий запрос выбранному провайдеру. */
export default defineEventHandler(async (event) => {
  const user = (event.context as { user?: { role?: unknown } }).user;
  if (user && user.role !== 'admin') return fail(event, 403, 'forbidden', 'Модели настраивает только администратор');
  const body = (await readBody(event)) as { id?: string } | null;
  await syncProviders();
  const provider = body?.id ? getProvider(body.id) : undefined;
  if (!provider) return fail(event, 404, 'not-found', 'Такого провайдера нет');
  const result = await provider.ask({ prompt: 'Ответь одним словом: готов.', timeoutMs: 30000 });
  return result.ok ? { ok: true, ms: result.ms } : { ok: false, failure: result.failure };
});
