import type { Severity } from '~~/server/lib/types';

/**
 * Язык интерфейса — русский (CLAUDE.md). Слова контракта остаются как есть в
 * коде и переводятся только на экране.
 */

export const TYPE_LABELS: Record<string, string> = {
  requirement: 'Требование',
  design: 'Документ',
  decision: 'Решение',
  contract: 'Контракт',
  task: 'Задача',
  phase: 'Фаза',
  verification: 'Проверка'
};

export const STATUS_LABELS: Record<string, string> = {
  draft: 'черновик',
  review: 'на подтверждении',
  approved: 'подтверждён',
  superseded: 'заменён',
  dropped: 'отменён',
  rejected: 'отклонён',
  backlog: 'в очереди',
  ready: 'готова к работе',
  in_progress: 'в работе',
  in_review: 'на проверке',
  done: 'закрыта',
  planned: 'запланирована',
  active: 'идёт'
};

export const RESULT_LABELS: Record<string, string> = {
  passed: 'прошла',
  failed: 'не прошла',
  skipped: 'пропущена'
};

export type BadgeColor = 'primary' | 'success' | 'warning' | 'error' | 'info' | 'neutral';

/** Цвет говорит о состоянии, а не украшает: зелёное — подтверждено фактом. */
export function statusColor(status: string): BadgeColor {
  switch (status) {
    case 'approved':
    case 'done':
    case 'passed':
      return 'success';
    case 'ready':
    case 'active':
      return 'primary';
    case 'in_progress':
    case 'in_review':
    case 'review':
      return 'info';
    case 'superseded':
    case 'dropped':
    case 'rejected':
      return 'neutral';
    case 'failed':
      return 'error';
    default:
      return 'neutral';
  }
}

export function severityColor(severity: Severity): BadgeColor {
  return severity === 'error' ? 'error' : 'warning';
}

export function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type;
}

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** «5 дней» вместо «5 день»: мелочь, которая выдаёт машинный текст. */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} ${few}`;
  return `${count} ${many}`;
}

export function daysSince(isoDate: string | null, now = new Date()): number | null {
  if (!isoDate) return null;
  const from = Date.parse(`${isoDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(from)) return null;
  const to = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.floor((to - from) / 86_400_000);
}

/**
 * Ключ строки нарушения: код, файл и запись. По нему нарушение отмечают на
 * экране и называют серверу — порядковый номер для этого не годится, он
 * меняется от перечитывания (docs/04-ui.md).
 */
export function issueKey(issue: { code: string; path?: string | null; recordId?: string | null }): string {
  return [issue.code, issue.path ?? '', issue.recordId ?? ''].join('|');
}
