import type { ModelEvent } from './stream-events';

/**
 * Интерфейс провайдера модели (docs/adr/0019-llm-providers.md, T-0019).
 *
 * Живёт в lib/, а не в utils/: это чистые типы и реестр без Nuxt, чтобы
 * маршрутизация, учёт и очередь опирались на контракт, а не на Claude Code.
 */

/** Агент работает в каталоге проекта с инструментами; чат только отвечает текстом. */
export type ProviderKind = 'agent' | 'chat';

/** Те же коды, что у Claude Code с самого начала: экраны не различают поставщиков. */
export type ProviderFailureCode = 'unavailable' | 'unauthorized' | 'timeout' | 'failed' | 'empty' | 'cancelled';

export interface ProviderFailure {
  code: ProviderFailureCode;
  message: string;
  detail?: string;
}

/** Права агента; чат-провайдер их игнорирует — инструментов у него нет. */
export type ProviderAccess = 'none' | 'read' | 'edits' | 'full';

export interface ProviderRequest {
  prompt: string;
  /** Неизменная часть запроса; чат-провайдер может закешировать её отдельно. */
  system?: string;
  /** Модель из настроек; не задана — по умолчанию провайдера. */
  model?: string;
  timeoutMs?: number;
  maxBytes?: number;
  signal?: AbortSignal;
  /** Лента хода работы; задана — провайдер стримит, не задана — один ответ. */
  onEvent?: (event: ModelEvent) => void;
  /** Только агенты: рабочая папка, права, продолжение разговора, усилие. */
  cwd?: string;
  access?: ProviderAccess;
  resume?: string;
  effort?: 'low';
}

export type ProviderResult =
  | { ok: true; answer: string; ms: number; sessionId?: string; model?: string; usage?: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } }
  | { ok: false; failure: ProviderFailure };

export interface ProviderAvailability {
  available: boolean;
  /** Почему недоступно — текст для человека. */
  reason?: string;
}

export interface Provider {
  /** Устойчивое имя для настроек и учёта: `claude-code`, `openai:ollama`. */
  id: string;
  label: string;
  kind: ProviderKind;
  availability(): ProviderAvailability | Promise<ProviderAvailability>;
  ask(request: ProviderRequest): Promise<ProviderResult>;
}

const registry = new Map<string, Provider>();

/** Повторная регистрация заменяет: провайдер из настроек обновляется без перезапуска. */
export function registerProvider(provider: Provider): void {
  registry.set(provider.id, provider);
}

export function unregisterProvider(id: string): void {
  registry.delete(id);
}

export function getProvider(id: string): Provider | undefined {
  return registry.get(id);
}

export function listProviders(): Provider[] {
  return [...registry.values()];
}

/** Первый повторяющийся id в списке настроек (PUT /api/llm/models отвечает 400 provider_duplicate). */
export function duplicateId(items: ReadonlyArray<{ id?: unknown }>): string | undefined {
  const seen = new Set<string>();
  for (const item of items) {
    if (typeof item.id !== 'string') continue;
    if (seen.has(item.id)) return item.id;
    seen.add(item.id);
  }
  return undefined;
}
