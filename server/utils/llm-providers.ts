import { listProviders, registerProvider, unregisterProvider } from '../lib/llm-provider';

import { anthropicProvider } from './llm-anthropic';
import { claudeCodeProvider } from './llm-claude';
import { openAiProvider } from './llm-openai';
import { loadLlmSettings } from './llm-settings';

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
    registerProvider(setting.type === 'anthropic' ? anthropicProvider(setting) : openAiProvider(setting));
  }
  // Агентов других задач не трогаем: снимаем только чат-провайдеров, которых больше нет в настройках.
  for (const provider of listProviders()) {
    if (provider.kind === 'chat' && !wanted.has(provider.id)) unregisterProvider(provider.id);
  }
}
