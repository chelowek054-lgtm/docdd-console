import { listProviders, registerProvider, unregisterProvider, type Provider } from '../lib/llm-provider';

import { anthropicProvider } from './llm-anthropic';
import { claudeCodeProvider } from './llm-claude';
import { openAiProvider } from './llm-openai';
import { codexProvider, geminiProvider } from './llm-agents';
import { loadLlmSettings, type ProviderSetting } from './llm-settings';

export const apiProvider = (setting: ProviderSetting) => setting.type === 'anthropic' ? anthropicProvider(setting) : openAiProvider(setting);

export async function probeProvider(provider: Provider, model?: string) {
  const result = await provider.ask({
    prompt: 'Ответь одним словом: привет. Не используй инструменты.',
    model,
    access: 'none',
    timeoutMs: 30000,
    maxOutputTokens: 512
  });
  return result.ok ? { ok: true as const, ms: result.ms } : { ok: false as const, failure: { code: result.failure.code } };
}

/**
 * Собирает реестр из настроек. Вызывается при каждой правке настроек, поэтому
 * провайдер добавляется без перезапуска сервера (T-0022). Claude Code есть всегда.
 */
export async function syncProviders(): Promise<void> {
  registerProvider(claudeCodeProvider);
  const settings = await loadLlmSettings();
  const wanted = new Set(['claude-code']);
  for (const setting of settings.providers) {
    if (setting.enabled === false) continue;
    wanted.add(setting.id);
    registerProvider(apiProvider(setting));
  }
  // Codex/Gemini подключаются, только если в llm.json названы: `"agents": ["codex-cli", "gemini-cli"]`.
  const named = Array.isArray(settings['agents']) ? settings['agents'] : [];
  for (const [id, make] of [['codex-cli', codexProvider], ['gemini-cli', geminiProvider]] as const) {
    if (named.includes(id)) { wanted.add(id); registerProvider(make()); } else unregisterProvider(id);
  }
  // Агентов других задач не трогаем: снимаем только чат-провайдеров, которых больше нет в настройках.
  for (const provider of listProviders()) {
    if (provider.kind === 'chat' && !wanted.has(provider.id)) unregisterProvider(provider.id);
  }
}
