import { getProvider } from '../lib/llm-provider';
import { LlmQueue } from '../lib/llm-queue';
import { parseRoutingTable, resolveRoute, type RoutingTable } from '../lib/llm-routing';
import { estimateCost, type PriceTable } from '../lib/llm-usage';

import { ask, type AskOptions, type LlmResult } from './llm';
import { syncProviders } from './llm-providers';
import { loadLlmSettings } from './llm-settings';
import { recordUsage } from './llm-usage-store';

/**
 * Единый путь запроса к модели (ADR-0019): маршрут по виду запроса → очередь
 * с пределом параллельности → провайдер → учёт. Раньше экраны звали ask()
 * напрямую, и таблица маршрутов, очередь и учёт лежали отдельно от реального пути.
 */

export interface RouteContext { projectId: string; user: string }

/** Одна очередь на сервер: лимиты модели общие у всей команды. Предел — DOCDD_LLM_PARALLEL, по умолчанию 2. */
export const llmQueue = new LlmQueue(Math.max(1, Number(process.env.DOCDD_LLM_PARALLEL) || 2));

/** Таблица цен лежит в llm.json рядом с маршрутами: `prices: { "модель": [вход, выход] }` USD за млн токенов. */
function parsePrices(raw: unknown): PriceTable {
  const out: PriceTable = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [model, pair] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') out[model] = [pair[0], pair[1]];
  }
  return out;
}

export async function loadRouting(): Promise<{ routes: RoutingTable; prices: PriceTable }> {
  const settings = await loadLlmSettings();
  return { routes: parseRoutingTable(settings['routes']), prices: parsePrices(settings['prices']) };
}

export async function askRouted(kind: string, ctx: RouteContext, prompt: string, options: AskOptions = {}): Promise<LlmResult> {
  await syncProviders();
  const { routes, prices } = await loadRouting();
  const needsTools = (options.access ?? 'read') !== 'none';
  const route = resolveRoute(routes, kind, needsTools, (id) => { const p = getProvider(id); return p ? { tools: p.kind === 'agent' } : undefined; }, { providerId: 'claude-code' });
  if (!route.ok) return { ok: false, failure: { code: 'unavailable', message: route.reason } };
  const { providerId, model } = route.target;
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, failure: { code: 'unavailable', message: `Провайдер «${providerId}» не подключён` } };

  const started = new Date().toISOString();
  let result = { ok: false, failure: { code: 'cancelled', message: 'Запрос отменён до запуска' } } as LlmResult;
  await new Promise<void>((resolve) => {
    llmQueue.enqueue({ projectId: ctx.projectId, user: ctx.user, kind }, async (queueSignal) => {
      // Сигнал очереди и сигнал вызывающего (обрыв браузера) — оба отменяют запрос.
      const merged = new AbortController();
      const stop = () => merged.abort();
      queueSignal.addEventListener('abort', stop);
      options.signal?.addEventListener('abort', stop);
      try {
        // Claude Code по умолчанию идёт прежним путём ask(): лента событий и сессии не меняются.
        result = providerId === 'claude-code' && !model
          ? await ask(prompt, { ...options, signal: merged.signal })
          : await provider.ask({
            prompt, ...(model ? { model } : {}), signal: merged.signal,
            ...(options.timeoutMs !== undefined ? { timeoutMs: options.timeoutMs } : {}),
            ...(options.maxBytes !== undefined ? { maxBytes: options.maxBytes } : {}),
            ...(options.cwd ? { cwd: options.cwd } : {}),
            ...(options.access ? { access: options.access } : {}),
            ...(options.resume ? { resume: options.resume } : {}),
            ...(options.effort ? { effort: options.effort } : {}),
            ...(options.onEvent ? { onEvent: options.onEvent } : {})
          });
        return { ok: result.ok, ...(result.ok ? {} : { note: result.failure.message }) };
      } finally {
        queueSignal.removeEventListener('abort', stop);
        options.signal?.removeEventListener('abort', stop);
        resolve();
      }
    });
  });

  const modelName = model ?? providerId;
  const answerChars = result.ok ? result.answer.length : 0;
  try {
    recordUsage({
      at: started, projectId: ctx.projectId, user: ctx.user, kind, providerId, model: modelName,
      promptChars: prompt.length, answerChars, ms: result.ok ? result.ms : Date.now() - Date.parse(started),
      ok: result.ok, costUsd: estimateCost(prices, modelName, prompt.length, answerChars)
    });
  } catch { /* учёт не должен ронять ответ */ }
  return result;
}
