import { notify } from './notification-service';

/**
 * Места событий процесса → уведомления (R-0059). Адресат — логин из самой записи
 * (`assignee`, `reviewer`); пустое поле — некого уведомлять. Сбой уведомления
 * не должен отменять правку записи, поэтому ошибки глотаем.
 */
type Fields = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

function send(projectId: string, kind: 'assigned' | 'reviewer_assigned' | 'awaiting_acceptance', recipient: string, recordId: string, message: string): void {
  if (!recipient) return;
  void notify(projectId, { kind, recipient, recordId, text: message }).catch(() => undefined);
}

/** Исполнитель или ревьюер назначены (изменились) — извещаем нового. */
export function notifyPatched(projectId: string, recordId: string, before: Fields, after: { assignee?: string | null; reviewer?: string | null }): void {
  if (after.assignee && after.assignee !== text(before['assignee'])) {
    send(projectId, 'assigned', after.assignee, recordId, `Вам назначена задача ${recordId}`);
  }
  if (after.reviewer && after.reviewer !== text(before['reviewer'])) {
    send(projectId, 'reviewer_assigned', after.reviewer, recordId, `Вы назначены ревьюером ${recordId}`);
  }
}

/** Задача перешла в `in_review` — ждёт приёмки у ревьюера. */
export function notifyStatus(projectId: string, recordId: string, type: string, status: string, data: Fields): void {
  if (type === 'task' && status === 'in_review') {
    send(projectId, 'awaiting_acceptance', text(data['reviewer']), recordId, `Задача ${recordId} ждёт приёмки`);
  }
}
