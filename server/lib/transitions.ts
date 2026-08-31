import { journalAction } from './actions';
import { checkTransition, type RuleContext } from './rules';
import type { RecordAction, WorkRecord } from './types';

/**
 * Куда запись может двинуться из своего статуса и что этому мешает. Считает
 * сервер теми же правилами, что дают список нарушений: экран не знает процесс.
 */

const NEXT_STATUSES: Record<string, readonly string[]> = {
  requirement: ['review', 'approved', 'draft', 'superseded', 'dropped'],
  design: ['review', 'approved', 'draft', 'superseded', 'dropped'],
  contract: ['review', 'approved', 'draft', 'superseded', 'dropped'],
  verification: ['review', 'approved', 'draft', 'superseded', 'dropped'],
  map: ['review', 'approved', 'draft', 'superseded', 'dropped'],
  decision: ['review', 'approved', 'draft', 'superseded', 'rejected'],
  task: ['ready', 'in_progress', 'in_review', 'done', 'backlog', 'dropped']
};

/** Подпись кнопки: глагол действия, а не имя статуса. */
const LABELS: Record<string, string> = {
  review: 'Отдать на подтверждение',
  approved: 'Подтвердить',
  draft: 'Вернуть в черновик',
  superseded: 'Пометить заменённым',
  rejected: 'Отклонить',
  dropped: 'Отменить',
  backlog: 'Вернуть в очередь',
  ready: 'Пометить готовой к работе',
  in_progress: 'Запустить в разработку',
  in_review: 'Отправить на проверку',
  done: 'Закрыть'
};

export function availableActions(record: WorkRecord, ctx: RuleContext): RecordAction[] {
  const candidates = NEXT_STATUSES[record.type] ?? [];
  return candidates
    .filter((status) => status !== record.status)
    .map((status): RecordAction | null => {
      const blockers = checkTransition(record, status, ctx);
      // Переход, которого нет в схеме статусов, не показывается вовсе: кнопка
      // «нельзя никогда» ничем не помогает.
      if (blockers.some((item) => item.code === 'transition_forbidden')) return null;
      return {
        status,
        label: LABELS[status] ?? journalAction(status),
        allowed: blockers.length === 0,
        blockers: blockers.map((item) => ({ code: item.code, message: item.message }))
      };
    })
    .filter((action): action is RecordAction => action !== null);
}
