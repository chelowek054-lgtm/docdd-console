// Относительный путь, а не алиас Nuxt: модуль читает и тест, который
// собирается без Nuxt (как app/utils/phases.ts).
/**
 * Факт — результат прогона, а не решение человека (docs/04-ui.md, «Решение и
 * факт»). «Подтверждён» — о статусе записи, «проверено» — только об этом файле.
 */

export type FactColor = 'success' | 'warning' | 'error' | 'neutral';

export interface Fact {
  label: string;
  color: FactColor;
}

type Results = Readonly<Record<string, { state: string } | undefined>>;

/**
 * Факт требования — по всем его проверкам сразу. Подтверждённое требование,
 * чей факт не «проверено», окрашено тёплым: человек согласился, а по чему
 * судить, что выполнено, — нет.
 */
export function requirementFact(verifications: readonly string[], results: Results, status: string): Fact {
  if (verifications.length === 0) return { label: 'не проверяется', color: 'warning' };

  const states = verifications.map((id) => results[id]?.state);
  if (states.some((state) => state === 'failed')) return { label: 'не прошла', color: 'error' };
  if (states.every((state) => state === 'passed')) return { label: 'проверено', color: 'success' };
  return { label: 'не проверено', color: status === 'approved' ? 'warning' : 'neutral' };
}

/** Закрытая задача без пройденной проверки — обещание, а не факт. Не закрытой факта ещё нет. */
export function taskFact(
  task: { status: string; links: { verified_by?: string[] } },
  results: Results
): Fact | null {
  if (task.status !== 'done') return null;

  const ids = task.links.verified_by ?? [];
  if (ids.length === 0) return { label: 'закрыта без проверки', color: 'warning' };
  if (ids.every((id) => results[id]?.state === 'passed')) return { label: 'проверена', color: 'success' };
  return { label: 'закрыта, не проверена', color: 'warning' };
}

/**
 * Результат есть, а сама проверка не подтверждена: прогон пошёл по способу, с
 * которым человек ещё не согласился. Результат от этого не обнуляется — он
 * засчитывается как есть, — но под фактом виден неподтверждённый способ.
 */
export function checkNote(status: string, hasResult: boolean): string | null {
  return hasResult && status !== 'approved' ? 'сама проверка не подтверждена' : null;
}
