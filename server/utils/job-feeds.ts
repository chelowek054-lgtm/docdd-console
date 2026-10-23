import { getHeader, type H3Event } from 'h3';

import { JobFeed, expired, peersOf, supersededBy, type FeedOwner } from '../lib/job-feed';

import { llmQueue } from './llm-gateway';
import { eventStream, type EventStream } from './sse';

/**
 * Реестр лент заданий к модели (ADR-0034): в памяти процесса, законченная лента живёт
 * час — достаточно, чтобы переподключиться после обновления страницы; дальше ответ
 * остаётся в журнале заданий (`.data/llm-jobs`).
 */
const TTL_MS = 60 * 60 * 1000;
const feeds = new Map<string, JobFeed>();

function sweep(now = Date.now()) {
  for (const [id, feed] of feeds) if (expired(feed, now, TTL_MS)) feeds.delete(id);
}

export function getFeed(id: string): JobFeed | undefined {
  sweep();
  return feeds.get(id);
}

export function whoIs(event: H3Event): { user: string; admin: boolean } {
  const user = (event.context as { user?: { login?: string; admin?: boolean } }).user;
  // Без входа учёток нет: все — один «local», и он же распоряжается всем.
  return user ? { user: user.login ?? 'local', admin: user.admin === true } : { user: 'local', admin: true };
}

export interface FeedStream extends EventStream {
  readonly id: string;
  /** Сигнал отмены задания: только кнопка «Отменить», не обрыв соединения. */
  readonly signal: AbortSignal;
  /** Задание встало в очередь модели: «Отменить» снимет и его. */
  queued(queueId: string): void;
}

/**
 * Лента задания вместо `eventStream`: события идут и в соединение (пока оно живо), и в
 * ленту на сервере. Первое событие — `feed` с номером; если такой же запрос идёт у
 * других людей — `peer` со списком. Прежнее задание того же человека с тем же ключом снимается.
 */
export function feedStream(event: H3Event, projectId: string): FeedStream {
  sweep();
  const { user } = whoIs(event);
  const owner: FeedOwner = { projectId, user, key: String(getHeader(event, 'x-model-job-key') ?? '').slice(0, 200) };
  for (const old of supersededBy(feeds.values(), owner)) old.cancel();
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const feed = new JobFeed(id, owner);
  feeds.set(id, feed);
  const wire = eventStream(event);

  const stream: FeedStream = {
    id,
    get signal() { return feed.signal; },
    get started() { return wire.started; },
    queued(queueId) {
      feed.signal.addEventListener('abort', () => llmQueue.cancel(queueId), { once: true });
      stream.send('job', { id: queueId });
    },
    send(name, payload) {
      feed.push(name, payload);
      wire.send(name, payload);
    },
    close() {
      feed.finish();
      wire.close();
    }
  };
  stream.send('feed', { id });
  const peers = peersOf(feeds.values(), owner);
  if (peers.length > 0) stream.send('peer', { users: peers });
  return stream;
}

/** Для тестов: начать ленту без HTTP. */
export function registerFeed(owner: FeedOwner): JobFeed {
  const feed = new JobFeed(`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, owner);
  feeds.set(feed.id, feed);
  return feed;
}

export function allFeeds(): IterableIterator<JobFeed> {
  return feeds.values();
}
