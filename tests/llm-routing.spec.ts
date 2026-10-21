// V-0009 (R-0009): маршрутизация вида запроса, учёт и месячная сводка, шлюз askRouted.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { unregisterProvider } from '../server/lib/llm-provider';
import { parseRoutingTable, resolveRoute } from '../server/lib/llm-routing';
import { estimateCost, parseLines, summarize, toLine, type UsageRecord } from '../server/lib/llm-usage';

const settingsRef: { value: Record<string, unknown> } = { value: { providers: [] } };
const recorded: UsageRecord[] = [];
vi.mock('../server/utils/llm-settings', async (original) => ({
  ...(await original<typeof import('../server/utils/llm-settings')>()),
  loadLlmSettings: async () => settingsRef.value
}));
vi.mock('../server/utils/llm-usage-store', () => ({ recordUsage: (r: UsageRecord) => { recorded.push(r); }, readUsage: () => [] }));

const { askRouted } = await import('../server/utils/llm-gateway');

describe('маршрутизация', () => {
  const caps = (id: string) => (id === 'agent' ? { tools: true } : id === 'chat' ? { tools: false } : undefined);
  it('запрос с инструментами не уходит чат-провайдеру — отказ с причиной', () => {
    const r = resolveRoute({ task: { providerId: 'chat' } }, 'task', true, caps);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('инструменты');
  });
  it('без инструментов чат разрешён; смена модели — правка таблицы', () => {
    expect(resolveRoute({ ask: { providerId: 'chat', model: 'a' } }, 'ask', false, caps)).toMatchObject({ ok: true, target: { model: 'a' } });
    expect(resolveRoute({ ask: { providerId: 'agent', model: 'b' } }, 'ask', true, caps)).toMatchObject({ ok: true, target: { model: 'b' } });
  });
  it('нет назначения и запасного — отказ; неподключённый — отказ; запасной работает', () => {
    expect(resolveRoute({}, 'k', false, caps).ok).toBe(false);
    expect(resolveRoute({ k: { providerId: 'gone' } }, 'k', false, caps).ok).toBe(false);
    expect(resolveRoute({}, 'k', true, caps, { providerId: 'agent' }).ok).toBe(true);
  });
  it('разбор таблицы отбрасывает кривое', () => {
    expect(parseRoutingTable(null)).toEqual({});
    expect(parseRoutingTable('x')).toEqual({});
    expect(parseRoutingTable({ a: null, b: { providerId: '' }, c: { providerId: 5 }, d: { providerId: 'p', model: '' }, e: { providerId: 'p', model: 'm' } }))
      .toEqual({ d: { providerId: 'p' }, e: { providerId: 'p', model: 'm' } });
  });
});

describe('шлюз askRouted (сеть подменена)', () => {
  const real = globalThis.fetch;
  beforeEach(() => { recorded.length = 0; });
  afterEach(() => { globalThis.fetch = real; unregisterProvider('chat1'); });
  const chat = { id: 'chat1', type: 'openai', model: 'm1', baseUrl: 'http://127.0.0.1:1/v1' };

  it('запрос с инструментами (по умолчанию read) чат-модели не отдаётся: в сеть не идёт', async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return new Response('{}'); }) as never;
    settingsRef.value = { providers: [chat], routes: { ask: { providerId: 'chat1' } } };
    const r = await askRouted('ask', { projectId: 'p', user: 'u' }, 'вопрос', {});
    expect(r.ok).toBe(false);
    expect(calls).toBe(0);
  });

  it('без инструментов идёт чат-модели; строка учёта: кто, вид, модель, размер, время, цена', async () => {
    globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: 'абвг' } }] }), { status: 200 })) as never;
    settingsRef.value = { providers: [chat], routes: { ask: { providerId: 'chat1', model: 'm1' } }, prices: { m1: [1, 2] } };
    const r = await askRouted('ask', { projectId: 'p', user: 'ann' }, '12345678', { access: 'none' });
    expect(r.ok).toBe(true);
    expect(recorded).toHaveLength(1);
    expect(recorded[0]).toMatchObject({ projectId: 'p', user: 'ann', kind: 'ask', providerId: 'chat1', model: 'm1', promptChars: 8, answerChars: 4, ok: true });
    expect(recorded[0]!.costUsd).toBeCloseTo((2 * 1 + 1 * 2) / 1_000_000, 12);
  });
});

describe('учёт и месячная сводка', () => {
  const rec = (over: Partial<UsageRecord>): UsageRecord => ({
    at: '2026-10-05T10:00:00.000Z', projectId: 'p', user: 'ann', kind: 'ask', providerId: 'o', model: 'm',
    promptChars: 400, answerChars: 400, ms: 100, ok: true, costUsd: 0.5, ...over
  });
  it('цена: оценка по 4 символа на токен; неизвестная модель — null', () => {
    expect(estimateCost({ m: [3, 15] }, 'm', 4_000_000, 400_000)).toBeCloseTo(4.5, 9);
    expect(estimateCost({}, 'm', 10, 10)).toBeNull();
  });
  it('сводка берёт месяц и проект, делит по людям и моделям, null-цена — ноль', () => {
    const all = [rec({}), rec({ user: 'bob', model: 'n', costUsd: null }), rec({ at: '2026-09-30T23:59:00Z' }), rec({ projectId: 'q' })];
    const s = summarize(all, '2026-10', 'p');
    expect(s.total).toMatchObject({ requests: 2, costUsd: 0.5, chars: 1600 });
    expect(Object.keys(s.byUser).sort()).toEqual(['ann', 'bob']);
    expect(s.byModel['n']!.requests).toBe(1);
    expect(summarize(all, '2026-10').total.requests).toBe(3);
  });
  it('строки JSONL: битые и чужие пропускаются', () => {
    expect(parseLines([toLine(rec({})), '{"at":"x"', 'null', '{"a":1}', ''].join('\n'))).toHaveLength(1);
  });
});
