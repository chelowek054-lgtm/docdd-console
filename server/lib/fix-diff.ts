import type { OrderGroup } from './order-diff';

/**
 * Предпросмотр починки «было → станет» (R-0072): план модели — таблица
 * «Файл | Что меняем | Во что | Почему» (docs/prompts/fix-plan.md). Чистая функция:
 * разбирает строки плана и разносит отмеченные нарушения на «закроется» и «останется».
 * Это предсказание по плану; фактический результат покажет повторная проверка.
 */

export interface FixIssue {
  code: string;
  path?: string | null | undefined;
  recordId?: string | null | undefined;
  message?: string | undefined;
}

export interface PlanRow {
  file: string;
  field: string;
  to: string;
  why: string;
  /** «Чинить нельзя» в колонке «Во что»: нарушение остаётся. */
  blocked: boolean;
}

export interface FixDiff {
  rows: PlanRow[];
  before: OrderGroup[];
  after: OrderGroup[];
  titles: Record<string, string>;
  closes: string[];
  stays: string[];
}

const cells = (line: string) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim().replace(/^`+|`+$/g, ''));

export function parsePlan(plan: string): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const line of plan.split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const [file = '', field = '', to = '', why = ''] = cells(line);
    if (!file || /^:?-{2,}:?$/.test(file) || /^файл$/i.test(file)) continue;
    rows.push({ file, field, to, why, blocked: /чинить\s+нельзя/i.test(to) });
  }
  return rows;
}

export const issueKey = (issue: FixIssue) => `${issue.code}:${issue.recordId ?? issue.path ?? ''}`;

export function fixDiff(issues: readonly FixIssue[], plan: string): FixDiff {
  const rows = parsePlan(plan);
  const fixable = (issue: FixIssue) => !!issue.path && rows.some((row) => !row.blocked && (row.file === issue.path || row.file.endsWith(issue.path!) || issue.path!.endsWith(row.file)));
  const titles: Record<string, string> = {};
  const closes: string[] = [];
  const stays: string[] = [];
  for (const issue of issues) {
    const key = issueKey(issue);
    titles[key] = issue.message ?? issue.path ?? '';
    (fixable(issue) ? closes : stays).push(key);
  }
  return {
    rows,
    before: [{ id: 'нарушения', items: issues.map(issueKey) }],
    after: [{ id: 'закроется', items: closes }, { id: 'останется', items: stays }],
    titles,
    closes,
    stays
  };
}
