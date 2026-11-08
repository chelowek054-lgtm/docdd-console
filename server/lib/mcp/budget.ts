/** Ответ по умолчанию: столько знаков хватает на списки и не забивает историю сессии. */
export const DEFAULT_BUDGET = 6_000;
/** Больше любого пакета контекста (ADR-0021): его режет сам пакет, целыми кусками. */
export const CONTEXT_BUDGET = 45_000;

/** Бюджет из аргумента инструмента: модель может сузить ответ, но не поднять выше предела. */
export function budgetFrom(args: Record<string, unknown>, limit = DEFAULT_BUDGET): number {
  const asked = args['budget'];
  return typeof asked === 'number' && Number.isFinite(asked) && asked >= 200 ? Math.min(Math.floor(asked), limit) : limit;
}

/**
 * Режем по целым строкам, а о потере говорим сверху: пометку внизу модель
 * может принять за конец данных и решить, что отрезанного не существует.
 */
export function cutToBudget(text: string, budget: number): string {
  if (text.length <= budget) return text;
  const lines = text.split('\n');
  const kept: string[] = [];
  let size = 0;
  for (const line of lines) {
    if (size + line.length + 1 > budget) break;
    kept.push(line);
    size += line.length + 1;
  }
  return `[отрезано: показано строк ${kept.length} из ${lines.length}, предел ${budget} знаков; сузьте запрос]\n${kept.join('\n')}`;
}
