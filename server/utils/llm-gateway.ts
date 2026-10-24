import { getProvider, listProviders } from '../lib/llm-provider';
import { LlmQueue, type JobOutcome } from '../lib/llm-queue';
import { defaultRoute, parseLimits, parseRoutingTable, resolveRoute, type RoutingTable } from '../lib/llm-routing';
import { costOf, tokensOf, type PriceTable } from '../lib/llm-usage';

import { ask, type AskOptions, type LlmResult } from './llm';
import { syncProviders } from './llm-providers';
import { BOOT_ID, saveJob } from './llm-jobs-store';
import { loadLlmSettings } from './llm-settings';
import { recordUsage } from './llm-usage-store';

/**
 * Единый путь запроса к модели (ADR-0019): маршрут по виду запроса → очередь
 * с пределом параллельности → провайдер → учёт. Раньше экраны звали ask()
 * напрямую, и таблица маршрутов, очередь и учёт лежали отдельно от реального пути.
 */

export interface RouteContext { projectId: string; user: string; /** Модель агента (R-0100): перекрывает модель маршрута. */ model?: string; /** Идентификатор задания: по нему клиент найдёт ответ после обновления страницы. */ onJob?: (id: string) => void }

/** Одна очередь на сервер: лимиты модели общие у всей команды. Предел — DOCDD_LLM_PARALLEL, по умолчанию 2. */
export const llmQueue = new LlmQueue(Math.max(1, Number(process.env.DOCDD_LLM_PARALLEL) || 2), 200, (job) => saveJob(job), BOOT_ID);

/** Таблица цен лежит в llm.json рядом с маршрутами: `prices: { "модель": [вход, выход] }` USD за млн токенов. */
function parsePrices(raw: unknown): PriceTable {
  const out: PriceTable = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [model, pair] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(pair) && typeof pair[0] === 'number' && typeof pair[1] === 'number') out[model] = typeof pair[2] === 'number' ? [pair[0], pair[1], pair[2]] : [pair[0], pair[1]];
  }
  return out;
}

export async function loadRouting(): Promise<{ routes: RoutingTable; prices: PriceTable; limits: Record<string, number> }> {
  const settings = await loadLlmSettings();
  return { routes: parseRoutingTable(settings['routes']), prices: parsePrices(settings['prices']), limits: parseLimits(settings['limits']) };
}

export async function askRouted(kind: string, ctx: RouteContext, prompt: string, options: AskOptions = {}): Promise<LlmResult> {
  await syncProviders();
  const { routes, prices, limits } = await loadRouting();
  const needsTools = (options.access ?? 'read') !== 'none';
  // Нет маршрута — разбор и сверка идут чат-модели, если она подключена (R-0093).
  const chat = listProviders().find((item) => item.kind === 'chat')?.id ?? null;
  const route = resolveRoute(routes, kind, needsTools, (id) => { const p = getProvider(id); return p ? { tools: p.kind === 'agent' } : undefined; }, defaultRoute(kind, needsTools, chat));
  const tokenLimit = limits[kind] ?? options.tokenLimit;
  if (!route.ok) return { ok: false, failure: { code: 'unavailable', message: route.reason } };
  const { providerId } = route.target;
  const model = ctx.model ?? route.target.model;
  const provider = getProvider(providerId);
  if (!provider) return { ok: false, failure: { code: 'unavailable', message: `Провайдер «${providerId}» не подключён` } };

  const started = new Date().toISOString();
  let result = { ok: false, failure: { code: 'cancelled', message: 'Запрос отменён до запуска' } } as LlmResult;
  await new Promise<void>((resolve) => {
    const queued = llmQueue.enqueue({ projectId: ctx.projectId, user: ctx.user, kind }, async (queueSignal) => {
      // Только сигнал очереди (явная отмена через DELETE): закрытие соединения браузера запрос не обрывает.
      const merged = { signal: queueSignal };
      try {
        // Claude Code по умолчанию идёт прежним путём ask(): лента событий и сессии не меняются.
        result = providerId === 'claude-code' && !model
          ? await ask(prompt, { ...options, signal: merged.signal, ...(tokenLimit ? { tokenLimit } : {}) })
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
        const outcome: JobOutcome = result.ok
          ? { ok: true, answer: result.answer, ms: result.ms }
          : { ok: false, note: result.failure.message, error: { code: result.failure.code, message: result.failure.message } };
        return outcome;
      } finally {
        resolve();
      }
    });
    ctx.onJob?.(queued.id);
  });

  const modelName = model ?? providerId;
  const answerChars = result.ok ? result.answer.length : 0;
  // Учёт по токенам провайдера; не отдал — оценка по символам с пометкой (R-0093).
  const tokens = tokensOf(result.ok ? (result as { usage?: Parameters<typeof tokensOf>[0] }).usage : undefined);
  const cost = costOf(prices, modelName, tokens, prompt.length, answerChars);
  try {
    recordUsage({
      at: started, projectId: ctx.projectId, user: ctx.user, kind, providerId, model: modelName,
      promptChars: prompt.length, answerChars, ms: result.ok ? result.ms : Date.now() - Date.parse(started),
      ok: result.ok, costUsd: cost.costUsd, estimated: cost.estimated, ...(tokens ? { tokens } : {})
    });
  } catch { /* учёт не должен ронять ответ */ }
  return result;
}
