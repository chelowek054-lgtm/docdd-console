/**
 * Обсуждение у записи (R-0060): замечания и ответы лежат файлом рядом с записью
 * (`<имя записи>.discussion.json`), а текст самого документа не трогают.
 * Чистые функции над объектом файла; чтение и запись — в слое сервера.
 */

export interface DiscussionReply {
  id: string;
  at: string;
  author: string;
  text: string;
}

export interface DiscussionThread {
  id: string;
  at: string;
  author: string;
  text: string;
  replies: DiscussionReply[];
  /** Закрытое замечание помечается, а не удаляется: история остаётся. */
  closed: boolean;
  closedBy?: string;
  closedAt?: string;
}

export interface Discussion {
  version: 1;
  threads: DiscussionThread[];
}

/** Путь файла обсуждения: рядом с записью, с тем же именем. */
export function discussionPath(recordPath: string): string {
  return recordPath.replace(/\.md$/i, '') + '.discussion.json';
}

export function emptyDiscussion(): Discussion {
  return { version: 1, threads: [] };
}

/** Незнакомые поля пропускаем, битый файл — пустое обсуждение: оно не должно ронять карточку. */
export function parseDiscussion(text: string): Discussion {
  try {
    const raw = JSON.parse(text) as Partial<Discussion>;
    return { version: 1, threads: Array.isArray(raw.threads) ? raw.threads : [] };
  } catch {
    return emptyDiscussion();
  }
}

export function serializeDiscussion(discussion: Discussion): string {
  return JSON.stringify(discussion, null, 2) + '\n';
}

const nextId = (prefix: string, count: number) => `${prefix}${count + 1}`;

export function addThread(discussion: Discussion, author: string, text: string, now: Date): Discussion {
  const thread: DiscussionThread = {
    id: nextId('c', discussion.threads.length),
    at: now.toISOString(),
    author,
    text,
    replies: [],
    closed: false
  };
  return { ...discussion, threads: [...discussion.threads, thread] };
}

export function addReply(discussion: Discussion, threadId: string, author: string, text: string, now: Date): Discussion | null {
  if (!discussion.threads.some((thread) => thread.id === threadId)) return null;
  return {
    ...discussion,
    threads: discussion.threads.map((thread) => (thread.id === threadId
      ? { ...thread, replies: [...thread.replies, { id: nextId('r', thread.replies.length), at: now.toISOString(), author, text }] }
      : thread))
  };
}

export function closeThread(discussion: Discussion, threadId: string, author: string, now: Date): Discussion | null {
  if (!discussion.threads.some((thread) => thread.id === threadId)) return null;
  return {
    ...discussion,
    threads: discussion.threads.map((thread) => (thread.id === threadId
      ? { ...thread, closed: true, closedBy: author, closedAt: now.toISOString() }
      : thread))
  };
}
