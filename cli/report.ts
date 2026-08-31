import type { IssueDto, ProjectIndex } from '../server/lib/types';

/**
 * Вывод проверки. Чистые функции над индексом: в тесте нет ни процесса, ни
 * терминала — только строки, которые человек прочитает в логе сборки.
 */

export interface Summary {
  errors: number;
  warnings: number;
  records: number;
}

export function summarize(index: ProjectIndex): Summary {
  return {
    errors: index.issues.filter((issue) => issue.severity === 'error').length,
    warnings: index.issues.filter((issue) => issue.severity === 'warning').length,
    records: index.records.length
  };
}

/**
 * Код возврата: `1` — только ошибки. Предупреждение не валит сборку, иначе
 * правило и мнение перестают отличаться (docs/05-validation.md).
 */
export function exitCode(index: ProjectIndex): number {
  return summarize(index).errors > 0 ? 1 : 0;
}

/** Вывод для человека: ошибки сверху, у каждой — путь и объяснение. */
export function formatText(index: ProjectIndex): string {
  const { errors, warnings, records } = summarize(index);
  const lines: string[] = [
    `${index.project.name} · ${plural(records, 'запись', 'записи', 'записей')}`,
    ''
  ];

  const ordered = [
    ...index.issues.filter((issue) => issue.severity === 'error'),
    ...index.issues.filter((issue) => issue.severity === 'warning')
  ];

  if (ordered.length === 0) {
    lines.push('Нарушений нет: документы и код говорят одно и то же.');
    return lines.join('\n');
  }

  for (const issue of ordered) {
    lines.push(...formatIssue(issue));
  }

  lines.push(
    '',
    `Ошибок: ${errors}. Предупреждений: ${warnings}.`,
    errors > 0
      ? 'Ошибка блокирует работу: её нельзя обойти, её нужно починить.'
      : 'Предупреждения на код возврата не влияют.'
  );
  return lines.join('\n');
}

function formatIssue(issue: IssueDto): string[] {
  const mark = issue.severity === 'error' ? 'ОШИБКА  ' : 'внимание';
  const where = issue.recordId ? `${issue.recordId} · ${issue.path}` : issue.path;
  return [`${mark} ${issue.code}`, `         ${where}`, `         ${issue.message}`, ''];
}

/** Вывод для сборки: то же самое, но разбирается программой. */
export function formatJson(index: ProjectIndex): string {
  const { errors, warnings, records } = summarize(index);
  return JSON.stringify(
    {
      project: index.project.id,
      builtAt: index.builtAt,
      records,
      errors,
      warnings,
      issues: index.issues
    },
    null,
    2
  );
}

function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}
