import type { Provider, ProviderRequest, ProviderResult } from '../lib/llm-provider';

import { ask, availability } from './llm';

/**
 * Claude Code как первый адаптер (T-0019). Поведение прежнее: всё делает
 * ask() из llm.ts, адаптер только приводит запрос и ответ к общему виду.
 */
export const claudeCodeProvider: Provider = {
  id: 'claude-code',
  label: 'Claude Code',
  kind: 'agent',
  availability() {
    const found = availability();
    return found.reason ? { available: found.available, reason: found.reason } : { available: found.available };
  },
  async ask(request: ProviderRequest): Promise<ProviderResult> {
    // Системная часть у агента — просто начало запроса: отдельного поля у CLI нет.
    const prompt = request.system ? `${request.system}\n\n${request.prompt}` : request.prompt;
    return ask(prompt, {
      ...(request.timeoutMs !== undefined ? { timeoutMs: request.timeoutMs } : {}),
      ...(request.maxBytes !== undefined ? { maxBytes: request.maxBytes } : {}),
      ...(request.cwd ? { cwd: request.cwd } : {}),
      ...(request.signal ? { signal: request.signal } : {}),
      ...(request.onEvent ? { onEvent: request.onEvent } : {}),
      ...(request.resume ? { resume: request.resume } : {}),
      ...(request.access ? { access: request.access } : {}),
      ...(request.effort ? { effort: request.effort } : {})
    });
  }
};
