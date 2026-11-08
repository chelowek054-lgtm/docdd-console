import { describe, expect, it } from 'vitest';

import { parseLines, type UsageRecord } from '../server/lib/llm-usage';
import { compareToBaseline, makeBaseline, renderTokenRows, tokenRows } from '../server/lib/tokens';

const base = { at: '2026-11-08T10:00:00Z', projectId: 'p', user: 'u', providerId: 'x', model: 'm', ms: 1, ok: true, costUsd: 0, promptChars: 400, answerChars: 40 };
const usage = (over: Partial<UsageRecord>): UsageRecord => ({ ...base, kind: 'task', ...over });
const tokens = { input: 10, output: 20, cacheRead: 30, cacheWrite: 40 };

describe('Отчёт расхода токенов (V-0117)', () => {
  it('суммирует по задаче и виду, считает заходы', () => {
    const rows = tokenRows([usage({ taskId: 'T-1', tokens }), usage({ taskId: 'T-1', tokens }), usage({ taskId: 'T-2', tokens }), usage({ kind: 'ask', tokens })]);
    expect(rows.find((row) => row.taskId === 'T-1')).toMatchObject({ requests: 2, input: 20, output: 40, cacheRead: 60, cacheWrite: 80, estimated: 0 });
    expect(rows.at(-1)).toMatchObject({ taskId: null, kind: 'ask', requests: 1 });
  });

  it('без токенов от провайдера значение — оценка, и это видно', () => {
    const rows = tokenRows([usage({ taskId: 'T-1' })]);
    expect(rows[0]).toMatchObject({ input: 100, output: 10, estimated: 1 });
    expect(renderTokenRows(rows)).toContain('оценка: 1 из 1');
  });

  it('фильтры по задаче и проекту', () => {
    const list = [usage({ taskId: 'T-1' }), usage({ taskId: 'T-2', projectId: 'q' })];
    expect(tokenRows(list, { taskId: 'T-2' })).toHaveLength(1);
    expect(tokenRows(list, { projectIds: ['q'] })[0]?.taskId).toBe('T-2');
  });

  it('битая строка журнала не роняет отчёт', () => {
    const line = JSON.stringify(usage({ taskId: 'T-1', tokens }));
    expect(tokenRows(parseLines(`${line}\n{обрезано\n`))).toHaveLength(1);
  });

  it('сравнение с базовой линией — на один заход по виду', () => {
    const baseline = makeBaseline(tokenRows([usage({ tokens: { input: 100, output: 0, cacheRead: 0, cacheWrite: 0 } })]), 'когда-то');
    const [row] = compareToBaseline(baseline, tokenRows([usage({ tokens: { input: 80, output: 0, cacheRead: 0, cacheWrite: 0 } })]));
    expect(row).toEqual({ kind: 'task', before: 100, after: 80, changePercent: -20 });
  });

  it('пустой журнал', () => expect(renderTokenRows([])).toContain('нет'));
});
