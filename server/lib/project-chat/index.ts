import { createHash } from 'node:crypto';

export interface ProjectChat {
  id: string;
  title: string;
  updated: string;
  archived: boolean;
  record: string;
  phase: string;
  providerId?: string;
  revision: number;
  turns: unknown[];
}

const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
export const validChatId = (id: unknown): id is string => typeof id === 'string' && uuid.test(id);

export function chatKey(root: string, login: string) {
  return 'project-chats:' + createHash('sha256').update(JSON.stringify([root, login])).digest('hex');
}

const storage = async () => (await import('nitropack/runtime')).useStorage('data');
const writes = new Map<string, Promise<unknown>>();

export async function listChats(key: string) {
  const store = await storage();
  const keys = await store.getKeys(key);
  const items = await store.getItems<ProjectChat>(keys);
  return items.flatMap(({ value }) => {
    if (!value) return [];
    const { turns: _turns, ...summary } = value;
    return [summary];
  }).sort((a, b) => b.updated.localeCompare(a.updated));
}

export async function getChat(key: string, id: string) {
  return (await storage()).getItem<ProjectChat>(key + ':' + id);
}

export async function saveChat(key: string, chat: ProjectChat) {
  const path = key + ':' + chat.id;
  const next = (writes.get(path) ?? Promise.resolve()).catch(() => undefined).then(async () => {
    const store = await storage();
    const previous = await store.getItem<ProjectChat>(path);
    if ((previous?.revision ?? 0) !== chat.revision) return null;
    const saved = { ...chat, revision: chat.revision + 1, updated: new Date().toISOString() };
    await store.setItem(path, saved);
    return saved;
  });
  writes.set(path, next);
  try {
    return await next;
  } finally {
    if (writes.get(path) === next) writes.delete(path);
  }
}
