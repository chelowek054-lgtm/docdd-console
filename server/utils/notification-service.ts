import { useStorage } from 'nitropack/runtime';

import {
  appendNotification,
  makeNotification,
  markRead,
  noopChannel,
  type ChannelAdapter,
  type Notification,
  type NotificationInput
} from '../lib/notifications';

/**
 * Хранилище уведомлений: `.data/notifications/<проект>.json`. Это данные
 * приложения, а не проекта, поэтому в репозиторий проекта они не попадают.
 * Запись идёт по очереди: параллельные события иначе затирают друг друга.
 */
let channel: ChannelAdapter = noopChannel;
let queue: Promise<unknown> = Promise.resolve();
let seq = 0;

const keyOf = (projectId: string) => `notifications/${projectId.replace(/[^\w.-]/g, '_')}.json`;

export function setChannel(adapter: ChannelAdapter): void {
  channel = adapter;
}

export async function listNotifications(projectId: string): Promise<Notification[]> {
  return (await useStorage('data').getItem<Notification[]>(keyOf(projectId))) ?? [];
}

function enqueue<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(run, run);
  queue = next.catch(() => undefined);
  return next;
}

/** Событие процесса → запись в хранилище → внешний канал. Сбой канала запись не отменяет. */
export function notify(projectId: string, input: NotificationInput): Promise<Notification> {
  return enqueue(async () => {
    const item = makeNotification(input, new Date(), seq++);
    await useStorage('data').setItem(keyOf(projectId), appendNotification(await listNotifications(projectId), item));
    try { await channel.send(item); } catch { /* канал необязателен */ }
    return item;
  });
}

export function readNotifications(projectId: string, recipient: string, ids: readonly string[]): Promise<void> {
  return enqueue(async () => {
    await useStorage('data').setItem(keyOf(projectId), markRead(await listNotifications(projectId), recipient, ids));
  });
}
