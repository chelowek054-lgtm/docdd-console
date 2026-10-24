/**
 * Маршрутизация: вид запроса → провайдер и модель (ADR-0019).
 *
 * Чистые функции без обращения к файлам. Типы здесь свои и минимальные: когда
 * появится реестр провайдеров (server/lib/llm-provider.ts), `RouteTarget.providerId`
 * ищется в нём, а `ProviderCaps.tools` берётся из описания провайдера.
 */

/** Вид запроса: 'plan', 'map', 'fix', 'task', ... — список открыт, правится в настройках. */
export type RequestKind = string;

export interface RouteTarget {
  providerId: string;
  /** Модель внутри провайдера; не задана — по умолчанию провайдера. */
  model?: string;
}

export type RoutingTable = Record<RequestKind, RouteTarget>;

export interface ProviderCaps {
  /** Умеет ли провайдер ходить по файлам и запускать команды (агентный). */
  tools: boolean;
}

export type Route =
  | { ok: true; target: RouteTarget }
  | { ok: false; reason: string };

/**
 * Выбор модели для запроса. Таблица — данные, поэтому смена модели у вида
 * запроса не требует правки кода. Запрос с инструментами чат-провайдеру не
 * отдаём: он молча выполнил бы его без файлов и соврал бы о результате.
 */
export function resolveRoute(
  table: RoutingTable,
  kind: RequestKind,
  needsTools: boolean,
  caps: (providerId: string) => ProviderCaps | undefined,
  fallback?: RouteTarget
): Route {
  const target = table[kind] ?? fallback;
  if (!target) return { ok: false, reason: `Для вида запроса «${kind}» не назначена модель` };
  const known = caps(target.providerId);
  if (!known) return { ok: false, reason: `Провайдер «${target.providerId}» не подключён` };
  if (needsTools && !known.tools) {
    return { ok: false, reason: `Запросу «${kind}» нужны инструменты, а «${target.providerId}» — чат-провайдер: назначьте агентного` };
  }
  return { ok: true, target };
}

/** Разбор таблицы из настроек: чужое и кривое отбрасывается, а не роняет сервер. */
export function parseRoutingTable(raw: unknown): RoutingTable {
  const table: RoutingTable = {};
  if (typeof raw !== 'object' || raw === null) return table;
  for (const [kind, value] of Object.entries(raw as Record<string, unknown>)) {
    const item = value as { providerId?: unknown; model?: unknown } | null;
    if (!item || typeof item.providerId !== 'string' || item.providerId === '') continue;
    table[kind] = { providerId: item.providerId, ...(typeof item.model === 'string' && item.model !== '' ? { model: item.model } : {}) };
  }
  return table;
}

/**
 * Маршрут по умолчанию (R-0093), когда в таблице вида запроса нет: разбор и
 * сверка — чат-модели (дешевле, инструменты им не нужны), всё, что работает с
 * кодом, — агенту. Чат-провайдера не подключено — тоже агент: лучше дорого, чем никак.
 */
export const CHAT_KINDS: ReadonlySet<string> = new Set(['inbox', 'inbox-plan', 'review', 'review-batch', 'analyst', 'batch-check', 'manager', 'ask', 'context']);

export function defaultRoute(kind: RequestKind, needsTools: boolean, chatProviderId: string | null, agentProviderId = 'claude-code'): RouteTarget {
  if (!needsTools && chatProviderId && CHAT_KINDS.has(kind)) return { providerId: chatProviderId };
  return { providerId: agentProviderId };
}

/** Лимиты токенов по виду запроса из настроек: `limits: { task: 2000000 }`. Кривое отбрасывается. */
export function parseLimits(raw: unknown): Record<RequestKind, number> {
  const out: Record<RequestKind, number> = {};
  if (typeof raw !== 'object' || raw === null) return out;
  for (const [kind, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[kind] = Math.floor(value);
  }
  return out;
}
