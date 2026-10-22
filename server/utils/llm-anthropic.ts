import type { Provider, ProviderRequest, ProviderResult } from '../lib/llm-provider';

import { emptyFailure, failureOf, sseData } from './llm-http';
import { resolveKey, type ProviderSetting } from './llm-settings';

/**
 * Чат-провайдер Anthropic Messages API (T-0021). Системная часть помечена для
 * кеширования: она повторяется между запросами, а платить за неё каждый раз незачем.
 */
export function anthropicProvider(setting: ProviderSetting): Provider {
  const base = (setting.baseUrl ?? 'https://api.anthropic.com').replace(/\/+$/, '');
  return {
    id: setting.id,
    label: setting.label ?? setting.id,
    kind: 'chat',
    availability() {
      return resolveKey(setting) === ''
        ? { available: false, reason: 'Не найден ключ Anthropic API: задайте переменную окружения из настроек.' }
        : { available: true };
    },
    async ask(request: ProviderRequest): Promise<ProviderResult> {
      const started = Date.now();
      const key = resolveKey(setting);
      if (key === '') return { ok: false, failure: { code: 'unauthorized', message: 'Не найден ключ Anthropic API' } };
      const controller = new AbortController();
      let timedOut = false;
      const timer = request.timeoutMs ? setTimeout(() => { timedOut = true; controller.abort(); }, request.timeoutMs) : undefined;
      const onAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onAbort, { once: true });
      const streaming = Boolean(request.onEvent);
      let status: number | undefined;
      try {
        const response = await fetch(`${base}/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: request.model ?? setting.model,
            max_tokens: 8192,
            stream: streaming,
            ...(request.system ? { system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }] } : {}),
            messages: [{ role: 'user', content: request.prompt }]
          }),
          signal: controller.signal
        });
        status = response.status;
        if (!response.ok || !response.body) {
          return { ok: false, failure: failureOf(undefined, status, request.signal, false) };
        }
        let answer = '';
        const usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } = {};
        if (streaming) {
          for await (const data of sseData(response.body)) {
            const event = JSON.parse(data) as {
              type?: string;
              delta?: { text?: string };
              message?: { usage?: { input_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number } };
              usage?: { output_tokens?: number };
            };
            if (event.type === 'content_block_delta' && event.delta?.text) {
              answer += event.delta.text;
              request.onEvent?.({ kind: 'text', text: event.delta.text });
            }
            if (event.type === 'message_start' && event.message?.usage?.input_tokens !== undefined) { usage.inputTokens = event.message.usage.input_tokens; usage.cacheReadTokens = event.message.usage.cache_read_input_tokens ?? 0; usage.cacheWriteTokens = event.message.usage.cache_creation_input_tokens ?? 0; }
            if (event.type === 'message_delta' && event.usage?.output_tokens !== undefined) usage.outputTokens = event.usage.output_tokens;
          }
        } else {
          const json = (await response.json()) as { content?: Array<{ type?: string; text?: string }>; usage?: { input_tokens?: number; output_tokens?: number } };
          answer = (json.content ?? []).filter((part) => part.type === 'text').map((part) => part.text ?? '').join('');
          if (json.usage?.input_tokens !== undefined) usage.inputTokens = json.usage.input_tokens;
          if (json.usage?.output_tokens !== undefined) usage.outputTokens = json.usage.output_tokens;
        }
        answer = answer.trim();
        if (answer === '') return emptyFailure();
        return { ok: true, answer, ms: Date.now() - started, model: request.model ?? setting.model, usage };
      } catch (error) {
        return { ok: false, failure: failureOf(error, status, request.signal, timedOut) };
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onAbort);
      }
    }
  };
}
