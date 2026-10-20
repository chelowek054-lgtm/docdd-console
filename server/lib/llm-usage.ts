/**
 * Учёт запросов к модели (ADR-0019): одна строка JSON на запрос.
 * Чистые функции; запись в `.data/llm-usage.jsonl` — в server/utils/llm-usage-store.ts.
 * Это данные приложения, а не проекта, поэтому в docs/development их нет.
 */

export interface UsageRecord {
  /** ISO-время начала. */
  at: string;
  projectId: string;
  /** Кто спросил: логин или 'local' без входа. */
  user: string;
  kind: string;
  providerId: string;
  model: string;
  /** Размер запроса и ответа в символах: токенов агентные CLI не сообщают. */
  promptChars: number;
  answerChars: number;
  ms: number;
  ok: boolean;
  /** Оценка цены в USD; null — цена модели неизвестна. */
  costUsd: number | null;
}

/** USD за миллион токенов: [вход, выход]. Таблица данных, правится без кода. */
export type PriceTable = Record<string, readonly [number, number]>;

/** Грубо: четыре символа на токен. Это оценка, и в отчёте она так и называется. */
export function estimateCost(prices: PriceTable, model: string, promptChars: number, answerChars: number): number | null {
  const price = prices[model];
  if (!price) return null;
  return ((promptChars / 4) * price[0] + (answerChars / 4) * price[1]) / 1_000_000;
}

export function toLine(record: UsageRecord): string {
  return JSON.stringify(record);
}

/** Битая строка пропускается: учёт не должен падать из-за одной обрезанной записи. */
export function parseLines(text: string): UsageRecord[] {
  const out: UsageRecord[] = [];
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const value = JSON.parse(line) as UsageRecord;
      if (typeof value.at === 'string' && typeof value.model === 'string') out.push(value);
    } catch { /* обрезанная строка */ }
  }
  return out;
}

export interface UsageTotal { requests: number; ms: number; chars: number; costUsd: number }

export interface UsageSummary {
  month: string;
  total: UsageTotal;
  byUser: Record<string, UsageTotal>;
  byModel: Record<string, UsageTotal>;
}

function add(into: UsageTotal, record: UsageRecord): void {
  into.requests += 1;
  into.ms += record.ms;
  into.chars += record.promptChars + record.answerChars;
  into.costUsd += record.costUsd ?? 0;
}

const empty = (): UsageTotal => ({ requests: 0, ms: 0, chars: 0, costUsd: 0 });

/** Сводка за месяц `YYYY-MM` по людям и моделям; projectId — только этого проекта. */
export function summarize(records: readonly UsageRecord[], month: string, projectId?: string): UsageSummary {
  const summary: UsageSummary = { month, total: empty(), byUser: {}, byModel: {} };
  for (const record of records) {
    if (!record.at.startsWith(month)) continue;
    if (projectId && record.projectId !== projectId) continue;
    add(summary.total, record);
    add((summary.byUser[record.user] ??= empty()), record);
    add((summary.byModel[record.model] ??= empty()), record);
  }
  return summary;
}
