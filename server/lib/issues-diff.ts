import type { IssueDto } from './types';

/**
 * Нарушения, которых до действия не было (docs/03-server-api.md, `newIssues`).
 * Ключ — код, запись, файл и текст: то же нарушение узнаётся, а сменившее
 * объяснение считается новым, потому что стало другим.
 */
export function newIssues(before: readonly IssueDto[], after: readonly IssueDto[]): IssueDto[] {
  const key = (issue: IssueDto) => `${issue.code}\u0000${issue.recordId ?? ''}\u0000${issue.path}\u0000${issue.message}`;
  const known = new Set(before.map(key));
  return after.filter((issue) => !known.has(key(issue)));
}
