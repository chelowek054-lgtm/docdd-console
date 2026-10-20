/**
 * Критерии приёмки в теле требования (docs/15-team-platform.md, R-0015).
 * Чистые функции над текстом: раздел «Критерии приёмки» → список критериев,
 * из каждого — заготовка записи `verification`.
 */

const HEADING = /^#{1,6}\s*Критерии приёмки\s*$/i;
const ANY_HEADING = /^#{1,6}\s+\S/;
const ITEM = /^\s*(?:[-*+]|\d+[.)])\s+(?:\[[ xXхХ]\]\s+)?(.+?)\s*$/;

/** Критерии — пункты списка под заголовком раздела, до следующего заголовка. Нет раздела — пусто, не ошибка. */
export function parseCriteria(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((line) => HEADING.test(line.trim()));
  if (start < 0) return [];
  const found: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (ANY_HEADING.test(line)) break;
    const match = ITEM.exec(line);
    if (match?.[1]) found.push(match[1]);
  }
  return found;
}

export interface VerificationDraft { title: string; kind: 'manual'; verifies: string }

/** Заготовка проверки: заголовок — сам критерий, связь `verifies` на требование. Уже заведённые (по заголовку) пропускаются. */
export function draftsFromCriteria(requirementId: string, criteria: readonly string[], existingTitles: readonly string[] = []): VerificationDraft[] {
  const have = new Set(existingTitles.map((title) => title.trim().toLowerCase()));
  return criteria
    .filter((criterion) => !have.has(criterion.trim().toLowerCase()))
    .map((criterion) => ({ title: criterion.length > 120 ? `${criterion.slice(0, 117)}...` : criterion, kind: 'manual' as const, verifies: requirementId }));
}
