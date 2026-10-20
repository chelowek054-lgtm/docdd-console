/**
 * Уведомления команды (R-0059, docs/15-team-platform.md). Чистые функции над
 * списком: файлов и сети здесь нет, чтобы их можно было тестировать без сервера.
 */

/** События процесса, о которых человека надо известить. */
export type NotificationKind =
  | 'assigned'
  | 'reviewer_assigned'
  | 'awaiting_acceptance'
  | 'violation_in_zone';

export interface Notification {
  id: string;
  at: string;
  kind: NotificationKind;
  /** Кому: идентификатор человека в приложении. */
  recipient: string;
  recordId?: string;
  text: string;
  read: boolean;
}

export interface NotificationInput {
  kind: NotificationKind;
  recipient: string;
  recordId?: string;
  text: string;
}

/** Не даём списку расти бесконечно: старые прочитанные никому не нужны. */
const KEEP = 200;

export function makeNotification(input: NotificationInput, now: Date, seq: number): Notification {
  return {
    id: `n-${now.getTime().toString(36)}-${seq}`,
    at: now.toISOString(),
    kind: input.kind,
    recipient: input.recipient,
    ...(input.recordId === undefined ? {} : { recordId: input.recordId }),
    text: input.text,
    read: false
  };
}

export function appendNotification(list: readonly Notification[], item: Notification): Notification[] {
  return [...list, item].slice(-KEEP);
}

/** Пустой `ids` — прочитать всё адресату. */
export function markRead(list: readonly Notification[], recipient: string, ids: readonly string[] = []): Notification[] {
  return list.map((item) => (
    item.recipient === recipient && (ids.length === 0 || ids.includes(item.id)) ? { ...item, read: true } : item
  ));
}

export function forRecipient(list: readonly Notification[], recipient: string): Notification[] {
  return list.filter((item) => item.recipient === recipient).reverse();
}

/**
 * Внешний канал (почта, мессенджер) по настройке администратора. Приложение
 * знает только этот интерфейс; конкретная отправка — отдельная задача.
 */
export interface ChannelAdapter {
  readonly name: string;
  send(item: Notification): Promise<void>;
}

/** Заглушка: ничего не отправляет, чтобы без настройки канала уведомления жили в приложении. */
export const noopChannel: ChannelAdapter = {
  name: 'none',
  send: () => Promise.resolve()
};
