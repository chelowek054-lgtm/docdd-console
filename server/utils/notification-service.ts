import { useStorage } from 'nitropack/runtime';

import {
  appendNotification,
  makeNotification,
  markRead,
  newZoneNotices,
  noopChannel,
  webhookChannel,
  type ZoneCapability,
  type ZoneIssue,
  type ZoneRecord,
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

let channelReady = false;

export function setChannel(adapter: ChannelAdapter): void {
  channel = adapter;
  channelReady = true;
}

const CONFIG_KEY = 'notifications.json';

/** Адрес вебхука: переменная окружения главнее файла настройки администратора. */
export async function loadChannelUrl(): Promise<string> {
  const env = process.env['DOCDD_NOTIFY_WEBHOOK']?.trim();
  if (env) return env;
  const stored = await useStorage('data').getItem<{ url?: string }>(CONFIG_KEY);
  return typeof stored?.url === 'string' ? stored.url.trim() : '';
}

export async function saveChannelUrl(url: string): Promise<void> {
  await useStorage('data').setItem(CONFIG_KEY, { url });
  channelReady = false;
}

/** Ленивое подключение при первом уведомлении; сбой чтения настройки оставляет заглушку. */
async function ensureChannel(): Promise<void> {
  if (channelReady) return;
  channelReady = true;
  try {
    const url = await loadChannelUrl();
    channel = /^https?:\/\//.test(url) ? webhookChannel(url) : noopChannel;
  } catch { channel = noopChannel; }
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
    await ensureChannel();
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

const seenKey = (projectId: string) => `notifications/${projectId.replace(/[^\w.-]/g, '_')}-seen.json`;

/**
 * Пересчёт нарушений (R-0059): новое нарушение в зоне владельца → уведомление.
 * Первый пересчёт проекта только запоминает текущее — иначе старый долг
 * обрушился бы на команду. Отпечатки уже отправленных лежат в `<проект>-seen.json`.
 */
export function notifyZoneViolations(
  projectId: string,
  issues: readonly ZoneIssue[],
  records: readonly ZoneRecord[],
  capabilities: readonly ZoneCapability[],
  team: readonly { login: string; roles: string[] }[]
): Promise<number> {
  return enqueue(async () => {
    const stored = await useStorage('data').getItem<{ seen?: string[] }>(seenKey(projectId));
    const { notices, fingerprints } = newZoneNotices(issues, new Set(stored?.seen ?? []), records, capabilities, team);
    if (!stored) notices.length = 0;
    await useStorage('data').setItem(seenKey(projectId), { seen: [...new Set(fingerprints)] });
    for (const input of notices) {
      await ensureChannel();
      const item = makeNotification(input, new Date(), seq++);
      await useStorage('data').setItem(keyOf(projectId), appendNotification(await listNotifications(projectId), item));
      try { await channel.send(item); } catch { /* канал необязателен */ }
    }
    return notices.length;
  });
}
