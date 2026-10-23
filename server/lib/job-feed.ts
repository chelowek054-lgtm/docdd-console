/**
 * Лента задания к модели (ADR-0034): события копятся на сервере, а не только уходят в
 * соединение. Браузер, потерявший соединение (обновление страницы, закрытая вкладка),
 * подключается заново и получает накопленное с нужного места и дальше по мере работы.
 * Чистый класс без Nitro: реестр, сроки и маршруты — в `server/utils/job-feeds.ts`.
 */

export interface FeedEvent { name: string; payload: unknown }

export interface FeedOwner { projectId: string; user: string; key: string }

type Listener = (event: FeedEvent, index: number) => void;

export class JobFeed {
  readonly events: FeedEvent[] = [];
  readonly controller = new AbortController();
  finishedAt: number | null = null;
  private listeners = new Set<Listener>();

  constructor(readonly id: string, readonly owner: FeedOwner, readonly startedAt: number = Date.now()) {}

  get done(): boolean {
    return this.finishedAt !== null;
  }

  get signal(): AbortSignal {
    return this.controller.signal;
  }

  push(name: string, payload: unknown): void {
    if (this.done) return;
    const event = { name, payload };
    this.events.push(event);
    const index = this.events.length - 1;
    for (const listener of [...this.listeners]) listener(event, index);
  }

  /** Конец ленты: после `done`/`error` новых событий нет, подписчики закрываются. */
  finish(now: number = Date.now()): void {
    if (this.done) return;
    this.finishedAt = now;
    for (const listener of [...this.listeners]) listener({ name: '__end', payload: null }, -1);
    this.listeners.clear();
  }

  /**
   * Подписка с места `from`: накопленное отдаётся сразу, дальше — по мере работы.
   * Событие `__end` — знак закрыть соединение. Возвращает отписку.
   */
  subscribe(from: number, listener: Listener): () => void {
    const start = Math.max(0, Math.min(from, this.events.length));
    for (let i = start; i < this.events.length; i += 1) listener(this.events[i] as FeedEvent, i);
    if (this.done) {
      listener({ name: '__end', payload: null }, -1);
      return () => {};
    }
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  cancel(): void {
    this.controller.abort();
  }
}

/** Видит ленту только её автор и администратор: чужое существование не раскрывается. */
export function canSee(feed: JobFeed, projectId: string, user: string, admin: boolean): boolean {
  return feed.owner.projectId === projectId && (admin || feed.owner.user === user);
}

/** Другие люди, у кого сейчас идёт задание с тем же ключом в том же проекте. */
export function peersOf(feeds: Iterable<JobFeed>, owner: FeedOwner): string[] {
  const users = new Set<string>();
  for (const feed of feeds) {
    if (feed.done || !owner.key) continue;
    if (feed.owner.projectId === owner.projectId && feed.owner.key === owner.key && feed.owner.user !== owner.user) users.add(feed.owner.user);
  }
  return [...users].sort();
}

/** Прежние идущие задания того же человека с тем же ключом: их снимает новый запуск. */
export function supersededBy(feeds: Iterable<JobFeed>, owner: FeedOwner): JobFeed[] {
  if (!owner.key) return [];
  return [...feeds].filter((feed) => !feed.done && feed.owner.projectId === owner.projectId && feed.owner.key === owner.key && feed.owner.user === owner.user);
}

/** Законченные ленты старше срока забываются: ответ остаётся в журнале заданий. */
export function expired(feed: JobFeed, now: number, ttlMs: number): boolean {
  return feed.finishedAt !== null && now - feed.finishedAt > ttlMs;
}
