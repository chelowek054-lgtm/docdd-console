import type { Provider, ProviderRequest, ProviderResult } from '../lib/llm-provider';

import { emptyFailure, failureOf, sseData } from './llm-http';
import { resolveKey, type ProviderSetting } from './llm-settings';

interface Usage { prompt_tokens?: number; completion_tokens?: number }

const tokens = (usage: Usage | undefined) =>
  usage ? { usage: { ...(usage.prompt_tokens !== undefined ? { inputTokens: usage.prompt_tokens } : {}), ...(usage.completion_tokens !== undefined ? { outputTokens: usage.completion_tokens } : {}) } } : {};

/**
 * Чат-провайдер OpenAI-совместимого API: OpenAI, OpenRouter, RouterAI, Ollama,
 * vLLM (T-0020). Ходит только по адресу из настроек; инструментов нет.
 */
export function openAiProvider(setting: ProviderSetting): Provider {
  const base = (setting.baseUrl ?? 'https://api.openai.com/v1').replace(/\/+$/, '');
  return {
    id: setting.id,
    label: setting.label ?? setting.id,
    kind: 'chat',
    availability() {
      // Локальной модели ключ не нужен, поэтому его отсутствие — не отказ.
      return { available: true };
    },
    async ask(request: ProviderRequest): Promise<ProviderResult> {
      const started = Date.now();
      const key = resolveKey(setting);
      const controller = new AbortController();
      let timedOut = false;
      const timer = request.timeoutMs ? setTimeout(() => { timedOut = true; controller.abort(); }, request.timeoutMs) : undefined;
      const onAbort = () => controller.abort();
      request.signal?.addEventListener('abort', onAbort, { once: true });
      const streaming = Boolean(request.onEvent);
      let status: number | undefined;
      try {
        const response = await fetch(`${base}/chat/completions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(key ? { authorization: `Bearer ${key}` } : {}) },
          body: JSON.stringify({
            model: request.model ?? setting.model,
            stream: streaming,
            messages: [
              ...(request.system ? [{ role: 'system', content: request.system }] : []),
              { role: 'user', content: request.prompt }
            ]
          }),
          signal: controller.signal
        });
        status = response.status;
        if (!response.ok || !response.body) {
          return { ok: false, failure: failureOf(undefined, status, request.signal, false) };
        }
        let answer = '';
        let usage: Usage | undefined;
        if (streaming) {
          for await (const data of sseData(response.body)) {
            if (data === '[DONE]') break;
            const chunk = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }>; usage?: Usage };
            const text = chunk.choices?.[0]?.delta?.content;
            if (text) { answer += text; request.onEvent?.({ kind: 'text', text }); }
            if (chunk.usage) usage = chunk.usage;
          }
        } else {
          const json = (await response.json()) as { choices?: Array<{ message?: { content?: string } }>; usage?: Usage };
          answer = json.choices?.[0]?.message?.content ?? '';
          usage = json.usage;
        }
        answer = answer.trim();
        if (answer === '') return emptyFailure();
        return { ok: true, answer, ms: Date.now() - started, model: request.model ?? setting.model, ...tokens(usage) };
      } catch (error) {
        return { ok: false, failure: failureOf(error, status, request.signal, timedOut) };
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener('abort', onAbort);
      }
    }
  };
}
