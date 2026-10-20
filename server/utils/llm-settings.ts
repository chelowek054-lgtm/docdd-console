import { env } from 'node:process';

import { useStorage } from 'nitropack/runtime';

/**
 * Настройки моделей в `.data/llm.json` (ADR-0019, п. 4; T-0022).
 * Файл вне репозитория. Ключ лучше называть переменной окружения (`apiKeyEnv`);
 * значение `apiKey` допустимо, но читается только сервером.
 */
export type ChatProviderType = 'openai' | 'anthropic';

export interface ProviderSetting {
  id: string;
  label?: string;
  type: ChatProviderType;
  /** Для OpenAI-совместимых — базовый адрес (`http://localhost:11434/v1`). */
  baseUrl?: string;
  model: string;
  apiKeyEnv?: string;
  apiKey?: string;
  /** Допущен ли провайдер к закрытым данным проекта. */
  closedData?: boolean;
  enabled?: boolean;
}

export interface LlmSettings {
  providers: ProviderSetting[];
  /** Незнакомые поля сохраняются как есть. */
  [extra: string]: unknown;
}

const FILE = 'llm.json';

export async function loadLlmSettings(): Promise<LlmSettings> {
  const stored = await useStorage('data').getItem<LlmSettings>(FILE);
  if (stored && typeof stored === 'object' && Array.isArray(stored.providers)) return stored;
  return { providers: [] };
}

export async function saveLlmSettings(settings: LlmSettings): Promise<void> {
  await useStorage('data').setItem(FILE, settings);
}

/** Значение ключа: переменная окружения важнее записи в файле. */
export function resolveKey(setting: Pick<ProviderSetting, 'apiKeyEnv' | 'apiKey'>): string {
  const fromEnv = setting.apiKeyEnv ? env[setting.apiKeyEnv] : undefined;
  return (fromEnv ?? setting.apiKey ?? '').trim();
}

export interface PublicProviderSetting extends Omit<ProviderSetting, 'apiKey'> {
  hasKey: boolean;
}

/** Вид для браузера: значения ключа здесь нет, только факт, что он найден. */
export function toPublic(setting: ProviderSetting): PublicProviderSetting {
  const { apiKey: _hidden, ...rest } = setting;
  return { ...rest, hasKey: resolveKey(setting) !== '' };
}
