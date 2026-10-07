import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useModelJobs } from '../app/stores/modelJobs';

/** Запросы к модели в общем хранилище (docs/04-ui.md, «Запрос к модели»; ADR-0017). */

const META = { label: 'Разбор входящего', to: '/projects/p/inbox' };

/** Ответ сервера лентой событий: куски, как они приходят по сети. */
function sse(...events: [string, unknown][]): Response {
  const text = events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    }
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

/** Ответ, который не кончается, пока его не оборвут: так выглядит запрос к модели посреди работы. */
function hanging(signal: AbortSignal): Promise<Response> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  });
}

beforeEach(() => {
  setActivePinia(createPinia());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('задание: ход и исход', () => {
  it('лента и ответ складываются в задание, итог — «ответ»', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(
      ['text', { kind: 'text', text: 'Читаю ' }],
      ['text', { kind: 'text', text: 'заметки' }],
      ['action', { kind: 'action', text: 'Read a.md' }],
      ['done', { answer: 'готово', ms: 5 }]
    )));
    const store = useModelJobs();
    const answer = await store.stream<{ answer: string }>('p:inbox', META, '/api/llm/ask', { prompt: 'x' });

    expect(answer).toEqual({ answer: 'готово', ms: 5 });
    const job = store.jobs['p:inbox'];
    expect(job?.running).toBe(false);
    expect(job?.outcome?.kind).toBe('answer');
    expect(job?.log.map((line) => line.text)).toEqual(['Читаю заметки', 'Read a.md']);
    expect(job?.label).toBe('Разбор входящего');
    expect(job?.to).toBe('/projects/p/inbox');
  });

  it('отказ сервера — итог «отказ» с причиной, ответа нет', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(['error', { error: { code: 'llm_failed', message: 'модель упала' } }])));
    const store = useModelJobs();
    expect(await store.stream('p:inbox', META, '/api/llm/ask', {})).toBeNull();
    const outcome = store.jobs['p:inbox']?.outcome;
    expect(outcome?.kind).toBe('failure');
    expect(outcome?.kind === 'failure' && outcome.failure.message).toBe('модель упала');
  });

  it('обрыв связи — «отказ network», а не исключение', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network down'); }));
    const store = useModelJobs();
    expect(await store.stream('p:inbox', META, '/api/llm/ask', {})).toBeNull();
    const outcome = store.jobs['p:inbox']?.outcome;
    expect(outcome?.kind === 'failure' && outcome.failure.code).toBe('network');
  });

  it('«Отменить» обрывает запрос: итог «отменено»', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => hanging(init.signal as AbortSignal)));
    const store = useModelJobs();
    const pending = store.stream('p:inbox', META, '/api/llm/ask', {});
    expect(store.jobs['p:inbox']?.running).toBe(true);
    expect(store.runningCount).toBe(1);

    store.cancel('p:inbox');
    expect(await pending).toBeNull();
    expect(store.jobs['p:inbox']?.outcome?.kind).toBe('cancelled');
    expect(store.runningCount).toBe(0);
  });
});

describe('уход со страницы запрос не обрывает', () => {
  it('страница ушла, пока идёт запрос: он идёт дальше, ответ ждёт возврата и виден в шапке', async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    const store = useModelJobs();
    const pending = store.stream<{ answer: string }>('p:inbox', META, '/api/llm/ask', {});

    store.orphan('p:inbox');
    expect(store.jobs['p:inbox']?.running).toBe(true);
    expect(store.visible.map((job) => job.key)).toEqual(['p:inbox']);

    release(sse(['done', { answer: 'пока вас не было' }]));
    expect(await pending).toEqual({ answer: 'пока вас не было' });

    const job = store.jobs['p:inbox'];
    expect(job?.running).toBe(false);
    expect(job?.orphaned).toBe(true);
    expect(job?.delivered).toBe(false);
    expect(job?.answer).toEqual({ answer: 'пока вас не было' });
    // Готовый ответ, который никто не принял, не пропадает из списка.
    expect(store.visible.map((item) => item.key)).toEqual(['p:inbox']);
  });

  it('принятый ответ из списка уходит; сброс убирает задание', async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { release = resolve; })));
    const store = useModelJobs();
    const pending = store.stream('p:inbox', META, '/api/llm/ask', {});
    store.orphan('p:inbox');
    release(sse(['done', { answer: 'x' }]));
    await pending;

    store.acknowledge('p:inbox');
    expect(store.visible).toEqual([]);
    store.drop('p:inbox');
    expect(store.jobs['p:inbox']).toBeUndefined();
  });

  it('идущее задание сбросить нельзя: сперва «Отменить»', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => hanging(init.signal as AbortSignal)));
    const store = useModelJobs();
    const pending = store.stream('p:inbox', META, '/api/llm/ask', {});
    store.drop('p:inbox');
    expect(store.jobs['p:inbox']).toBeDefined();
    store.cancel('p:inbox');
    await pending;
  });

  it('страница осталась на месте — ответ доходит ей, а в шапку не попадает', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sse(['done', { answer: 'на месте' }])));
    const store = useModelJobs();
    expect(await store.stream('p:inbox', META, '/api/llm/ask', {})).toEqual({ answer: 'на месте' });
    expect(store.jobs['p:inbox']?.delivered).toBe(true);
    expect(store.visible).toEqual([]);
  });
});

describe('несколько заданий и повторный запуск', () => {
  it('задания разных страниц не мешают друг другу; счётчик считает идущие', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => hanging(init.signal as AbortSignal)));
    const store = useModelJobs();
    const first = store.stream('p:inbox', META, '/api/llm/ask', {});
    const second = store.stream('p:verify', { label: 'Сверка', to: '/projects/p/shared' }, '/api/llm/ask', {});
    expect(store.runningCount).toBe(2);

    store.cancel('p:inbox');
    await first;
    expect(store.runningCount).toBe(1);
    expect(store.jobs['p:verify']?.running).toBe(true);
    store.cancelAll();
    await second;
    expect(store.runningCount).toBe(0);
  });

  it('новый запрос с тем же ключом стирает прошлый итог и обрывает прежний', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => hanging(init.signal as AbortSignal)));
    const store = useModelJobs();
    const first = store.stream('p:inbox', META, '/api/llm/ask', {});
    const second = store.stream('p:inbox', META, '/api/llm/ask', {});
    expect(await first).toBeNull();
    expect(store.jobs['p:inbox']?.running).toBe(true);
    expect(store.jobs['p:inbox']?.outcome).toBeNull();
    store.cancel('p:inbox');
    await second;
  });
});

describe('пакетный прогон в хранилище', () => {
  it('состояние прогона одно на ключ и переживает страницу; идущий прогон считается работой', () => {
    const store = useModelJobs();
    const batch = store.batchOf('p:maps-batch');
    expect(store.batchOf('p:maps-batch')).toBe(batch);
    expect(store.runningCount).toBe(0);

    batch.running = true;
    expect(store.runningCount).toBeGreaterThan(0);
    batch.running = false;
    expect(store.runningCount).toBe(0);
  });
});
