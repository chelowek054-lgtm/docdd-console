import type { ChosenIssue } from './fix-service';

/**
 * Нарушения, названные браузером (docs/04-ui.md, раздел «Нарушения»). Читаем
 * строго: сюда приходит выбор человека, и всё, что не похоже на нарушение,
 * просто не попадает в список.
 */
export function pickedIssues(value: unknown): ChosenIssue[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .filter((item) => typeof item['code'] === 'string')
    .map((item) => ({
      code: item['code'] as string,
      ...(typeof item['path'] === 'string' ? { path: item['path'] } : {}),
      ...(typeof item['recordId'] === 'string' ? { recordId: item['recordId'] } : {})
    }));
}
