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
  /** Цена в USD; null — цена модели неизвестна. */
  costUsd: number | null;
  /** Токены из ответа провайдера (R-0093); нет — провайдер их не отдал. */
  tokens?: UsageTokens;
  /** Цена — оценка по символам, а не по токенам: на экране помечается «≈». */
  estimated?: boolean;
}

/** Токены одного запроса так, как их отдаёт провайдер: вход, выход и кэш (чтение и запись). */
export interface UsageTokens { input: number; output: number; cacheRead: number; cacheWrite: number }

/** USD за миллион токенов: [вход, выход] или [вход, выход, чтение кэша]. Таблица данных, правится без кода. */
export type PriceTable = Record<string, readonly [number, number] | readonly [number, number, number]>;

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

export interface UsageTotal { requests: number; ms: number; chars: number; costUsd: number; /** Токенов всего по факту. */ tokens: number; /** Сколько запросов посчитано оценкой по символам. */ estimated: number }

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
  if (record.tokens) into.tokens += record.tokens.input + record.tokens.output + record.tokens.cacheRead + record.tokens.cacheWrite;
  // Старые строки учёта (до R-0093) — без поля: они все были оценкой.
  if (record.estimated !== false) into.estimated += 1;
}

const empty = (): UsageTotal => ({ requests: 0, ms: 0, chars: 0, costUsd: 0, tokens: 0, estimated: 0 });

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

/**
 * Цена запроса (R-0093): по токенам провайдера, если он их отдал; иначе — оценка
 * по символам, и она так и помечена (`estimated`). Чтение кэша — третья цена
 * в таблице, а нет её — десятая часть входа; запись в кэш — вход с надбавкой в четверть.
 */
export function costOf(prices: PriceTable, model: string, tokens: UsageTokens | undefined, promptChars: number, answerChars: number): { costUsd: number | null; estimated: boolean } {
  if (!tokens) return { costUsd: estimateCost(prices, model, promptChars, answerChars), estimated: true };
  const price = prices[model];
  if (!price) return { costUsd: null, estimated: false };
  const [input, output] = price;
  const cacheRead = price[2] ?? input / 10;
  const cost = tokens.input * input + tokens.output * output + tokens.cacheRead * cacheRead + tokens.cacheWrite * input * 1.25;
  return { costUsd: cost / 1_000_000, estimated: false };
}

/** Токены из того, что отдал провайдер: недостающее — ноль, а не «неизвестно». */
export function tokensOf(usage: { inputTokens?: number; outputTokens?: number; cacheReadTokens?: number; cacheWriteTokens?: number } | undefined): UsageTokens | undefined {
  if (!usage || (usage.inputTokens === undefined && usage.outputTokens === undefined)) return undefined;
  return { input: usage.inputTokens ?? 0, output: usage.outputTokens ?? 0, cacheRead: usage.cacheReadTokens ?? 0, cacheWrite: usage.cacheWriteTokens ?? 0 };
}

/** Всего токенов запроса — то, с чем сравнивается лимит задачи. */
export const totalTokens = (tokens: UsageTokens): number => tokens.input + tokens.output + tokens.cacheRead + tokens.cacheWrite;
