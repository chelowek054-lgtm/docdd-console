import { useStorage } from 'nitropack/runtime';

import type { ProjectEntry } from '../lib/types';

/**
 * Список проектов — единственные собственные данные приложения (docs/01-architecture.md).
 */
const KEY = 'projects.json';

function storage() {
  return useStorage('data');
}

/**
 * Читать файл на каждый запрос и перезаписывать его без очереди нельзя: при параллельных
 * запросах читатель ловит файл посреди перезаписи, видит пустой список, а писатель, опираясь
 * на него, стирает проекты. Поэтому список живёт в памяти процесса (сервер один), а записи
 * идут по очереди.
 */
/** Метку «открывался» не пишем чаще раза в минуту: это самая частая запись. */
const TOUCH_EVERY_MS = 60_000;

let cache: ProjectEntry[] | null = null;
let queue: Promise<unknown> = Promise.resolve();


async function load(): Promise<ProjectEntry[]> {
  if (cache) return cache;
  const stored = await storage().getItem<ProjectEntry[]>(KEY);
  // Нет массива — файл пуст или перезаписывается: отдаём пусто, но не запоминаем.
  if (!Array.isArray(stored)) return [];
  cache = stored;
  return cache;
}

/** Записи выстраиваются в цепочку: каждая видит результат предыдущей. */
function mutate<T>(change: (projects: ProjectEntry[]) => { next: ProjectEntry[]; result: T }): Promise<T> {
  const run = queue.then(async () => {
    const { next, result } = change([...(await load())]);
    cache = next;
    await storage().setItem(KEY, next);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export async function listProjects(): Promise<ProjectEntry[]> {
  return [...(await load())];
}

export async function findProject(id: string): Promise<ProjectEntry | null> {
  return (await load()).find((entry) => entry.id === id) ?? null;
}

export function saveProject(entry: ProjectEntry): Promise<ProjectEntry[]> {
  return mutate((projects) => {
    const at = projects.findIndex((item) => item.id === entry.id);
    if (at === -1) projects.push(entry);
    else projects[at] = entry;
    return { next: projects, result: projects };
  });
}

export function removeProject(id: string): Promise<boolean> {
  return mutate((projects) => {
    const left = projects.filter((entry) => entry.id !== id);
    return { next: left, result: left.length !== projects.length };
  });
}

export async function touchProject(id: string): Promise<void> {
  const entry = await findProject(id);
  if (!entry) return;
  const last = entry.lastOpenedAt ? Date.parse(entry.lastOpenedAt) : 0;
  if (Date.now() - last < TOUCH_EVERY_MS) return;
  await saveProject({ ...entry, lastOpenedAt: new Date().toISOString() });
}
