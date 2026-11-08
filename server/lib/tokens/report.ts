import type { UsageRecord } from '../llm-usage';

/** Строка отчёта: задача (нет — запрос вне задачи) и вид запроса. */
export interface TokenRow {
  taskId: string | null;
  kind: string;
  /** Заходов: каждый запрос к модели по этой задаче и виду. */
  requests: number;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Запросов без токенов от провайдера: их размер оценён по символам. */
  estimated: number;
}

/** Четыре знака на токен: та же оценка, что в цене (`estimateCost`). */
const CHARS_PER_TOKEN = 4;

export function tokenRows(records: readonly UsageRecord[], filter: { projectIds?: readonly string[]; taskId?: string } = {}): TokenRow[] {
  const rows = new Map<string, TokenRow>();
  for (const record of records) {
    if (filter.projectIds && !filter.projectIds.includes(record.projectId)) continue;
    const taskId = record.taskId ?? null;
    if (filter.taskId && taskId !== filter.taskId) continue;
    const kind = record.kind ?? '?';
    const key = `${taskId ?? ''} ${kind}`;
    const row = rows.get(key) ?? { taskId, kind, requests: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, estimated: 0 };
    row.requests += 1;
    if (record.tokens) {
      row.input += record.tokens.input;
      row.output += record.tokens.output;
      row.cacheRead += record.tokens.cacheRead;
      row.cacheWrite += record.tokens.cacheWrite;
    } else {
      row.input += Math.ceil((record.promptChars ?? 0) / CHARS_PER_TOKEN);
      row.output += Math.ceil((record.answerChars ?? 0) / CHARS_PER_TOKEN);
      row.estimated += 1;
    }
    rows.set(key, row);
  }
  // Запросы вне задачи — в конце: отчёт читают ради задач.
  return [...rows.values()].sort((a, b) => Number(a.taskId === null) - Number(b.taskId === null) || (a.taskId ?? '').localeCompare(b.taskId ?? '') || a.kind.localeCompare(b.kind));
}

export const totalTokens = (row: Pick<TokenRow, 'input' | 'output' | 'cacheRead' | 'cacheWrite'>): number => row.input + row.output + row.cacheRead + row.cacheWrite;

export interface TokenBaseline { kind: 'token-baseline'; at: string; rows: TokenRow[] }

export const makeBaseline = (rows: readonly TokenRow[], at: string): TokenBaseline => ({ kind: 'token-baseline', at, rows: [...rows] });

/** Изменение к базовой линии по виду запроса, на один заход: задачи разные, а средний заход сравним. */
export function compareToBaseline(baseline: TokenBaseline, current: readonly TokenRow[]): { kind: string; before: number; after: number; changePercent: number | null }[] {
  const perRequest = (rows: readonly TokenRow[]) => {
    const sums = new Map<string, { tokens: number; requests: number }>();
    for (const row of rows) {
      const sum = sums.get(row.kind) ?? { tokens: 0, requests: 0 };
      sum.tokens += totalTokens(row);
      sum.requests += row.requests;
      sums.set(row.kind, sum);
    }
    return new Map([...sums].map(([kind, sum]) => [kind, sum.requests ? Math.round(sum.tokens / sum.requests) : 0]));
  };
  const before = perRequest(baseline.rows);
  const after = perRequest(current);
  return [...new Set([...before.keys(), ...after.keys()])].sort().map((kind) => {
    const was = before.get(kind) ?? 0;
    const now = after.get(kind) ?? 0;
    return { kind, before: was, after: now, changePercent: was ? Math.round(((now - was) / was) * 100) : null };
  });
}

export function renderTokenRows(rows: readonly TokenRow[]): string {
  if (rows.length === 0) return 'Запросов к модели в журнале нет.';
  return rows.map((row) => {
    const mark = row.estimated ? ` (оценка: ${row.estimated} из ${row.requests})` : '';
    return `${row.taskId ?? 'вне задачи'} · ${row.kind} · заходов ${row.requests} · вход ${row.input} · выход ${row.output} · кэш чтение ${row.cacheRead} · кэш запись ${row.cacheWrite}${mark}`;
  }).join('\n');
}
