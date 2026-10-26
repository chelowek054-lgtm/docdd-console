/**
 * Бэклог — пул на будущее (R-0105, docs/02-workspace-contract.md, «Статусы»):
 * принятое, но отложенное «на потом». Чистые функции: куда идёт запись и что
 * пишется в журнал. Обратно — без нового подтверждения: решение уже принято.
 */

export type DeferDirection = 'defer' | 'return';

export const DEFER_DIRECTIONS: readonly DeferDirection[] = ['defer', 'return'];

/** Целевой статус записи; `null` — у этого типа бэклога нет. */
export function deferTarget(type: string, direction: DeferDirection): string | null {
  if (type === 'requirement') return direction === 'defer' ? 'deferred' : 'approved';
  if (type === 'task') return direction === 'defer' ? 'deferred' : 'backlog';
  return null;
}

/**
 * Строка журнала. Возврат начинается словом статуса («подтверждён», «в очередь»):
 * так его читает расчёт таймингов, а история курса подтверждением карты его не
 * сочтёт — там нужна строка ровно «подтверждён».
 */
export function deferAction(type: string, direction: DeferDirection, reason: string): string {
  const why = reason.replace(/\s+/g, ' ').trim();
  if (direction === 'defer') return why ? `в бэклог: ${why}` : 'в бэклог';
  const word = type === 'requirement' ? 'подтверждён' : 'в очередь';
  return why ? `${word}: из бэклога — ${why}` : `${word}: из бэклога`;
}
