// V-0008 (R-0008): реестр провайдеров, адаптеры по сети (fetch подменён), ключ не уходит клиенту.
import { afterEach, describe, expect, it } from 'vitest';

import { duplicateId, getProvider, listProviders, registerProvider, unregisterProvider, type Provider } from '../server/lib/llm-provider';
import { anthropicProvider } from '../server/utils/llm-anthropic';
import { openAiProvider } from '../server/utils/llm-openai';
import { resolveKey, toPublic } from '../server/utils/llm-settings';

const fake = (id: string, kind: 'agent' | 'chat'): Provider => ({
  id, label: id, kind, availability: () => ({ available: true }), ask: async () => ({ ok: true, answer: 'ответ', ms: 1 })
});

describe('реестр', () => {
  afterEach(() => unregisterProvider('x'));
  it('повторная регистрация заменяет запись, а не дублирует', () => {
    registerProvider(fake('x', 'chat'));
    registerProvider(fake('x', 'agent'));
    expect(listProviders().filter((p) => p.id === 'x')).toHaveLength(1);
    expect(getProvider('x')?.kind).toBe('agent');
    unregisterProvider('x');
    expect(getProvider('x')).toBeUndefined();
  });
});

describe('ключ не уходит клиенту', () => {
  it('toPublic убирает apiKey и сообщает только hasKey', () => {
    const view = toPublic({ id: 'a', type: 'openai', model: 'm', apiKey: 'sk-SECRET' });
    expect(JSON.stringify(view)).not.toContain('sk-SECRET');
    expect(view.hasKey).toBe(true);
    expect(toPublic({ id: 'a', type: 'openai', model: 'm' }).hasKey).toBe(false);
  });
  it('переменная окружения важнее файла и тоже не попадает в публичный вид', () => {
    process.env['REVIEW_TEST_KEY'] = '  env-secret ';
    try {
      const setting = { id: 'a', type: 'openai' as const, model: 'm', apiKeyEnv: 'REVIEW_TEST_KEY', apiKey: 'file' };
      expect(resolveKey(setting)).toBe('env-secret');
      expect(JSON.stringify(toPublic(setting))).not.toContain('env-secret');
    } finally { delete process.env['REVIEW_TEST_KEY']; }
  });
  it('незнакомые поля сохраняются (кроме ключа)', () => {
    const view = toPublic({ id: 'a', type: 'openai', model: 'm', apiKey: 'k', extra: 1 } as never) as unknown as Record<string, unknown>;
    expect(view['extra']).toBe(1);
    expect('apiKey' in view).toBe(false);
  });
});

describe('адаптеры по сети', () => {
  const real = globalThis.fetch;
  afterEach(() => { globalThis.fetch = real; });

  it('OpenAI-совместимый: ответ и токены, адрес из настроек, ключ только в заголовке', async () => {
    let seen: { url: string; init: RequestInit } | undefined;
    globalThis.fetch = (async (url: string, init: RequestInit) => {
      seen = { url, init };
      return new Response(JSON.stringify({ choices: [{ message: { content: ' привет ' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } }), { status: 200 });
    }) as never;
    const p = openAiProvider({ id: 'o', type: 'openai', model: 'm', baseUrl: 'http://localhost:11434/v1/', apiKey: 'sk-1' });
    expect(await p.ask({ prompt: 'q', system: 's' })).toMatchObject({ ok: true, answer: 'привет', usage: { inputTokens: 3, outputTokens: 2 } });
    expect(seen!.url).toBe('http://localhost:11434/v1/chat/completions');
    expect(String(seen!.init.body)).not.toContain('sk-1');
    expect(p.kind).toBe('chat');
  });

  it('401 → unauthorized, пустой → empty, сеть → unavailable без ключа в тексте', async () => {
    const p = openAiProvider({ id: 'o', type: 'openai', model: 'm', apiKey: 'sk-LEAK' });
    globalThis.fetch = (async () => new Response('no', { status: 401 })) as never;
    expect(await p.ask({ prompt: 'q' })).toMatchObject({ ok: false, failure: { code: 'unauthorized' } });
    globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '  ' } }] }), { status: 200 })) as never;
    expect(await p.ask({ prompt: 'q' })).toMatchObject({ ok: false, failure: { code: 'empty' } });
    globalThis.fetch = (async () => { throw new Error('ECONNREFUSED'); }) as never;
    const r = await p.ask({ prompt: 'q' });
    expect(r).toMatchObject({ ok: false, failure: { code: 'unavailable' } });
    expect(JSON.stringify(r)).not.toContain('sk-LEAK');
  });

  it('отмена сигналом даёт cancelled', async () => {
    globalThis.fetch = ((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(new DOMException('aborted', 'AbortError')));
    })) as never;
    const c = new AbortController();
    const pending = openAiProvider({ id: 'o', type: 'openai', model: 'm' }).ask({ prompt: 'q', signal: c.signal });
    c.abort();
    expect(await pending).toMatchObject({ ok: false, failure: { code: 'cancelled' } });
  });

  it('Anthropic: без ключа недоступен; системная часть помечена для кеша; ключ в x-api-key', async () => {
    const setting = { id: 'a', type: 'anthropic' as const, model: 'claude-x' };
    expect(await anthropicProvider(setting).availability()).toMatchObject({ available: false });
    expect(await anthropicProvider(setting).ask({ prompt: 'q' })).toMatchObject({ ok: false, failure: { code: 'unauthorized' } });
    let init: RequestInit | undefined;
    globalThis.fetch = (async (_u: string, i: RequestInit) => {
      init = i;
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ок' }], usage: { input_tokens: 5, output_tokens: 1 } }), { status: 200 });
    }) as never;
    expect(await anthropicProvider({ ...setting, apiKey: 'ak-1' }).ask({ prompt: 'q', system: 'sys' })).toMatchObject({ ok: true, answer: 'ок' });
    expect(JSON.parse(String(init!.body)).system[0].cache_control).toEqual({ type: 'ephemeral' });
    expect(String(init!.body)).not.toContain('ak-1');
    expect((init!.headers as Record<string, string>)['x-api-key']).toBe('ak-1');
  });
});

describe('настройки провайдеров', () => {
  it('повторяющийся id находится (PUT отвечает 400 provider_duplicate)', () => {
    expect(duplicateId([{ id: 'a' }, { id: 'b' }])).toBeUndefined();
    expect(duplicateId([{ id: 'a' }, { id: 'b' }, { id: 'a' }])).toBe('a');
  });
});
