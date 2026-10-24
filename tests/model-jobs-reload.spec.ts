import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { JobFeed, canSee, expired, peersOf, supersededBy } from '../server/lib/job-feed';
import { useModelJobs } from '../app/stores/modelJobs';

/** Запросы к модели переживают обновление страницы (ADR-0034, docs/04-ui.md, «Запрос к модели»). */

const META = { label: 'Разбор входящего', to: '/projects/p/inbox' };

function sse(...events: [string, unknown][]): Response {
  const text = events.map(([name, data]) => `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(text)); controller.close(); } });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

/** Простая замена sessionStorage для теста без браузера. */
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => { data.delete(key); },
    setItem: (key, value) => { data.set(key, String(value)); }
  };
}

beforeEach(() => { setActivePinia(createPinia()); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('лента задания на сервере', () => {
  const owner = { projectId: 'p', user: 'anna', key: 'p:inbox' };

  it('копит события; подписка с места отдаёт накопленное и дальше по мере работы, конец закрывает', () => {
    const feed = new JobFeed('f1', owner);
    feed.push('text', { text: 'а' });
    feed.push('text', { text: 'б' });
    const got: string[] = [];
    feed.subscribe(1, (event) => got.push(event.name === '__end' ? 'конец' : String((event.payload as { text?: string }).text ?? event.name)));
    feed.push('done', { answer: 'ок' });
    feed.finish();
    expect(got).toEqual(['б', 'done', 'конец']);
    // После конца новых событий нет, подписка сразу отдаёт всё и конец.
    feed.push('text', { text: 'поздно' });
    const late: string[] = [];
    feed.subscribe(0, (event) => late.push(event.name));
    expect(late).toEqual(['text', 'text', 'done', '__end']);
  });

  it('отмена — только явная: сигнал задания срабатывает от cancel()', () => {
    const feed = new JobFeed('f2', owner);
    expect(feed.signal.aborted).toBe(false);
    feed.cancel();
    expect(feed.signal.aborted).toBe(true);
  });

  it('видит только автор и администратор, и только в своём проекте', () => {
    const feed = new JobFeed('f3', owner);
    expect(canSee(feed, 'p', 'anna', false)).toBe(true);
    expect(canSee(feed, 'p', 'boris', false)).toBe(false);
    expect(canSee(feed, 'p', 'boris', true)).toBe(true);
    expect(canSee(feed, 'q', 'anna', true)).toBe(false);
  });

  it('одинаковые запросы: другие люди с тем же ключом — «peer»; тот же человек снимает своё прежнее', () => {
    const mine = new JobFeed('a', owner);
    const boris = new JobFeed('b', { ...owner, user: 'boris' });
    const other = new JobFeed('c', { ...owner, user: 'vera', key: 'p:analyst' });
    const doneOne = new JobFeed('d', { ...owner, user: 'gleb' });
    doneOne.finish();
    const all = [mine, boris, other, doneOne];
    expect(peersOf(all, owner)).toEqual(['boris']);
    expect(supersededBy(all, owner).map((feed) => feed.id)).toEqual(['a']);
    expect(peersOf(all, { ...owner, key: '' })).toEqual([]);
  });

  it('законченная лента забывается через срок, идущая — нет', () => {
    const feed = new JobFeed('e', owner);
    expect(expired(feed, Date.now() + 10 * 3600_000, 3600_000)).toBe(false);
    feed.finish(1000);
    expect(expired(feed, 1000 + 3600_001, 3600_000)).toBe(true);
  });
});

describe('хранилище: номер ленты, «такой же запрос», переподключение', () => {
  it('событие feed даёт номер ленты, peer — список людей; ключ уходит заголовком', async () => {
    const fetchMock = vi.fn(async () => sse(['feed', { id: 'f1' }], ['peer', { users: ['boris'] }], ['done', { answer: 'ок' }]));
    vi.stubGlobal('fetch', fetchMock);
    const store = useModelJobs();
    await store.stream('p:inbox', META, '/api/llm/ask', {});
    expect(store.jobs['p:inbox']?.feedId).toBe('f1');
    expect(store.jobs['p:inbox']?.peers).toEqual(['boris']);
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['X-Model-Job-Key']).toBe('p:inbox');
  });

  it('лента оборвалась посреди работы — подключаемся к заданию с того же места и получаем ответ', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => sse(['feed', { id: 'f1' }], ['text', { kind: 'text', text: 'Читаю' }]))
      .mockImplementationOnce(async () => sse(['done', { answer: 'готово' }]));
    vi.stubGlobal('fetch', fetchMock);
    const store = useModelJobs();
    const answer = await store.stream<{ answer: string }>('p:inbox', META, '/api/llm/ask', {});
    expect(answer).toEqual({ answer: 'готово' });
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/projects/p/llm/feeds/f1?from=2');
  });

  it('«Отменить» снимает задание на сервере, а не только обрывает соединение', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init?: RequestInit) => {
      calls.push([url, init]);
      if (init?.method === 'DELETE') return Promise.resolve(new Response('{}'));
      const encoder = new TextEncoder();
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode('event: feed\ndata: {"id":"f9"}\n\n'));
          init?.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError')));
        }
      });
      return Promise.resolve(new Response(body, { headers: { 'content-type': 'text/event-stream' } }));
    }));
    const store = useModelJobs();
    const pending = store.stream('p:inbox', META, '/api/llm/ask', {});
    await vi.waitFor(() => expect(store.jobs['p:inbox']?.feedId).toBe('f9'));
    store.cancel('p:inbox');
    await pending;
    expect(calls.some(([url, init]) => init?.method === 'DELETE' && url === '/api/projects/p/llm/feeds/f9')).toBe(true);
    expect(store.jobs['p:inbox']?.outcome?.kind).toBe('cancelled');
  });

  it('после перезагрузки: идущее подключается заново, ответ ждёт страницу один раз', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] });
    const storage = memoryStorage();
    vi.stubGlobal('sessionStorage', storage);
    // Лента, которая ещё не кончилась: так выглядит запрос посреди работы в момент перезагрузки.
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream<Uint8Array>({
      start(controller) { controller.enqueue(new TextEncoder().encode('event: feed\ndata: {"id":"f1"}\n\nevent: text\ndata: {"kind":"text","text":"Читаю"}\n\n')); }
    }), { headers: { 'content-type': 'text/event-stream' } })));
    const first = useModelJobs();
    void first.stream('p:inbox', META, '/api/llm/ask', {});
    await vi.waitFor(() => expect(first.jobs['p:inbox']?.seen).toBe(2));
    vi.advanceTimersByTime(600);
    expect(storage.getItem('docdd.modelJobs')).toContain('"feedId":"f1"');

    // «Обновили страницу»: новое хранилище, тот же sessionStorage.
    setActivePinia(createPinia());
    const fetchMock = vi.fn(async () => sse(['text', { kind: 'text', text: ' дальше' }], ['done', { answer: 'готово' }]));
    vi.stubGlobal('fetch', fetchMock);
    const second = useModelJobs();
    second.restore();
    expect(second.jobs['p:inbox']?.running).toBe(true);
    await vi.waitFor(() => expect(second.jobs['p:inbox']?.running).toBe(false));
    expect((fetchMock.mock.calls[0] as unknown[] | undefined)?.[0]).toBe('/api/projects/p/llm/feeds/f1?from=2');
    const job = second.jobs['p:inbox'];
    expect(job?.answer).toEqual({ answer: 'готово' });
    expect(job?.log.map((line) => line.text)).toEqual(['Читаю дальше']);
    // Страница, начавшая запрос, ушла вместе с перезагрузкой: ответ примет следующая.
    expect(job?.orphaned).toBe(true);
    expect(job?.delivered).toBe(false);
    expect(second.visible.map((item) => item.key)).toEqual(['p:inbox']);
  });

  it('сервер забыл задание (перезапуск) — итог «отказ» с понятной причиной, а не вечный счётчик', async () => {
    const storage = memoryStorage();
    storage.setItem('docdd.modelJobs', JSON.stringify({ at: Date.now(), jobs: [{
      key: 'p:inbox', label: 'x', to: '/', running: true, elapsed: 3, outcome: null, log: [], answer: null,
      orphaned: false, delivered: false, feedId: 'gone', seen: 1, peers: [], startedAt: Date.now() - 3000
    }] }));
    vi.stubGlobal('sessionStorage', storage);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":{"code":"feed_not_found","message":"нет"}}', { status: 404 })));
    const store = useModelJobs();
    store.restore();
    await vi.waitFor(() => expect(store.jobs['p:inbox']?.running).toBe(false));
    const outcome = store.jobs['p:inbox']?.outcome;
    expect(outcome?.kind === 'failure' && outcome.failure.code).toBe('feed_gone');
  });

  it('сохранённое старше суток не восстанавливается', () => {
    const storage = memoryStorage();
    storage.setItem('docdd.modelJobs', JSON.stringify({ at: Date.now() - 25 * 3600_000, jobs: [{ key: 'p:inbox', running: false, startedAt: 0 }] }));
    vi.stubGlobal('sessionStorage', storage);
    const store = useModelJobs();
    store.restore();
    expect(store.jobs['p:inbox']).toBeUndefined();
  });
});
