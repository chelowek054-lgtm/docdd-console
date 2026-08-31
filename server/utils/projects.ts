import { useStorage } from 'nitropack/runtime';

import type { ProjectEntry } from '../lib/types';

/**
 * Список проектов — единственные собственные данные приложения. Содержимое
 * проектов не копируется (docs/01-architecture.md).
 */
const KEY = 'projects.json';

function storage() {
  return useStorage('data');
}

export async function listProjects(): Promise<ProjectEntry[]> {
  const stored = await storage().getItem<ProjectEntry[]>(KEY);
  return Array.isArray(stored) ? stored : [];
}

export async function findProject(id: string): Promise<ProjectEntry | null> {
  return (await listProjects()).find((entry) => entry.id === id) ?? null;
}

export async function saveProject(entry: ProjectEntry): Promise<ProjectEntry[]> {
  const projects = await listProjects();
  const at = projects.findIndex((item) => item.id === entry.id);
  if (at === -1) projects.push(entry);
  else projects[at] = entry;
  await storage().setItem(KEY, projects);
  return projects;
}

export async function removeProject(id: string): Promise<boolean> {
  const projects = await listProjects();
  const left = projects.filter((entry) => entry.id !== id);
  if (left.length === projects.length) return false;
  await storage().setItem(KEY, left);
  return true;
}

export async function touchProject(id: string): Promise<void> {
  const entry = await findProject(id);
  if (entry) await saveProject({ ...entry, lastOpenedAt: new Date().toISOString() });
}
