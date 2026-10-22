// Экономия токенов: учёт по факту, постоянная часть пакета первой, маршрут по умолчанию, лимит (R-0093).
import { describe, expect, it } from 'vitest';

import { buildContextPack, makeChunk } from '../server/lib/context-pack';
import { defaultRoute, parseLimits } from '../server/lib/llm-routing';
import { costOf, summarize, tokensOf, totalTokens, type UsageRecord } from '../server/lib/llm-usage';
import { UsageMeter, parseLine } from '../server/lib/stream-events';
import { ask, type Runner } from '../server/utils/llm';

describe('учёт по токенам провайдера', () => {
  const prices = { m: [3, 15, 0.3] as const, n: [2, 10] as const };
  it('есть токены — цена по ним и без «≈»; кэш дешевле входа', () => {
    const tokens = { input: 1_000_000, output: 100_000, cacheRead: 1_000_000, cacheWrite: 0 };
    expect(costOf(prices, 'm', tokens, 0, 0)).toEqual({ costUsd: 3 + 1.5 + 0.3, estimated: false });
  });
  it('без третьей цены чтение кэша — десятая часть входа', () => {
    expect(costOf(prices, 'n', { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 0 }, 0, 0).costUsd).toBeCloseTo(0.2);
  });
  it('токенов нет — оценка по символам с пометкой', () => {
    expect(costOf(prices, 'n', undefined, 4_000_000, 0)).toEqual({ costUsd: 2, estimated: true });
  });
  it('tokensOf: недостающее — ноль; ничего не отдано — undefined', () => {
    expect(tokensOf({ inputTokens: 10, outputTokens: 5 })).toEqual({ input: 10, output: 5, cacheRead: 0, cacheWrite: 0 });
    expect(tokensOf({})).toBeUndefined();
    expect(totalTokens({ input: 1, output: 2, cacheRead: 3, cacheWrite: 4 })).toBe(10);
  });
  it('сводка считает токены и сколько запросов оценено', () => {
    const base = { projectId: 'p', user: 'u', kind: 'k', providerId: 'x', model: 'm', promptChars: 0, answerChars: 0, ms: 1, ok: true, at: '2026-10-22T00:00:00Z' };
    const records: UsageRecord[] = [
      { ...base, costUsd: 1, estimated: false, tokens: { input: 10, output: 5, cacheRead: 0, cacheWrite: 0 } },
      { ...base, costUsd: 0.5, estimated: true }
    ];
    const total = summarize(records, '2026-10').total;
    expect(total).toMatchObject({ requests: 2, tokens: 15, estimated: 1, costUsd: 1.5 });
  });
});

describe('лента Claude Code: учёт и его сумма', () => {
  const state = () => ({ sawDelta: false, tools: new Map<string, string>() });
  it('сообщение модели с учётом и итог результата дают события usage', () => {
    const assistant = JSON.stringify({ type: 'assistant', message: { id: 'msg1', content: [], usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 50 } } });
    const result = JSON.stringify({ type: 'result', result: 'Готово', usage: { input_tokens: 300, output_tokens: 40 }, total_cost_usd: 0.01 });
    expect(parseLine(assistant, state()).map((e) => e.kind)).toEqual(['usage']);
    expect(parseLine(result, state()).map((e) => e.kind)).toEqual(['answer', 'usage']);
  });
  it('одно сообщение несколькими записями считается раз; итог главнее суммы', () => {
    const meter = new UsageMeter();
    const line = JSON.stringify({ type: 'assistant', message: { id: 'a', content: [], usage: { input_tokens: 10, output_tokens: 2 } } });
    for (let i = 0; i < 3; i += 1) for (const event of parseLine(line, state())) meter.push(event);
    expect(meter.total).toBe(12);
    for (const event of parseLine(JSON.stringify({ type: 'result', usage: { input_tokens: 40, output_tokens: 4 }, total_cost_usd: 0.02 }), state())) meter.push(event);
    expect(meter.total).toBe(44);
    expect(meter.costUsd).toBe(0.02);
  });
});

describe('лимит токенов на запрос', () => {
  it('превышение останавливает модель с понятной причиной', async () => {
    const run: Runner = (_command, _args, _input, options) => new Promise((resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      options.onData?.(JSON.stringify({ type: 'assistant', message: { id: 'a', content: [], usage: { input_tokens: 900, output_tokens: 200 } } }) + '\n');
      setTimeout(() => resolve({ stdout: '', stderr: '', code: 0 }), 50);
    });
    const result = await ask('вопрос', { run, onEvent: () => undefined, tokenLimit: 1000 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.message).toMatch(/Превышен лимит токенов на запрос: 1000/);
  });
  it('в пределах лимита — ответ с учётом токенов', async () => {
    const run: Runner = (_command, _args, _input, options) => {
      options.onData?.([
        JSON.stringify({ type: 'assistant', message: { id: 'a', content: [], usage: { input_tokens: 10, output_tokens: 2 } } }),
        JSON.stringify({ type: 'result', result: 'Ответ.', usage: { input_tokens: 10, output_tokens: 2, cache_read_input_tokens: 5 } })
      ].join('\n') + '\n');
      return Promise.resolve({ stdout: '', stderr: '', code: 0 });
    };
    const result = await ask('вопрос', { run, onEvent: () => undefined, tokenLimit: 1000 });
    expect(result.ok && result.usage).toEqual({ inputTokens: 10, outputTokens: 2, cacheReadTokens: 5, cacheWriteTokens: 0 });
  });
  it('лимиты из настроек: кривое отбрасывается', () => {
    expect(parseLimits({ task: 2_000_000, map: -1, x: 'много' })).toEqual({ task: 2_000_000 });
  });
});

describe('маршрут по умолчанию', () => {
  it('разбор и сверка — чат-модели, код — агенту; без чата — агент', () => {
    expect(defaultRoute('inbox', false, 'openai:x')).toEqual({ providerId: 'openai:x' });
    expect(defaultRoute('task', true, 'openai:x')).toEqual({ providerId: 'claude-code' });
    expect(defaultRoute('inbox', true, 'openai:x')).toEqual({ providerId: 'claude-code' });
    expect(defaultRoute('inbox', false, null)).toEqual({ providerId: 'claude-code' });
  });
});

describe('постоянная часть пакета — первой и одинаковой', () => {
  const source = (center: string) => () => [
    makeChunk({ key: `record:${center}`, kind: 'record', source: center, why: 'центр', title: center, text: center, rank: 0 }),
    makeChunk({ key: 'practices', kind: 'practices', source: 'p', why: 'практики', title: 'Практики', text: 'правила кода', rank: 30 }),
    makeChunk({ key: 'reference', kind: 'reference', source: 'r', why: 'справочник', title: 'Справочник', text: 'индекс', rank: 40 })
  ];
  const pack = (center: string) => buildContextPack({
    records: [], centerId: center, vision: 'вектор',
    needs: { kinds: ['record', 'vision', 'practices', 'reference'], budget: 100_000 },
    sources: [source(center)]
  });
  it('вектор, практики, справочник идут до центра запроса', () => {
    expect(pack('T-1').chunks.map((c) => c.kind)).toEqual(['vision', 'practices', 'reference', 'record']);
  });
  it('у двух разных запросов начало пакета совпадает', () => {
    const a = pack('T-1').chunks.slice(0, 3).map((c) => c.text);
    const b = pack('T-2').chunks.slice(0, 3).map((c) => c.text);
    expect(a).toEqual(b);
  });
  it('тесный бюджет: постоянная часть режется, а центр запроса — нет', () => {
    const tight = buildContextPack({
      records: [], centerId: 'T-1', vision: 'вектор'.repeat(50),
      needs: { kinds: ['record', 'vision', 'practices', 'reference'], budget: 10 },
      sources: [source('T-1')]
    });
    expect(tight.chunks.map((c) => c.kind)).toContain('record');
  });
});
