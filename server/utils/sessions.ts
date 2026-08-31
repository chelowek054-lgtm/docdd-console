import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { normalizeRoot } from '../lib/paths';

/**
 * Память о разговорах с моделью: у какой задачи какая сессия
 * (docs/09-execution.md). Нужна затем, чтобы повторный заход продолжал прошлый
 * разговор, а не проходил сотню шагов разбора заново.
 *
 * Лежит в `.docdd` и потому расходная: удалили — следующий заход просто
 * начнётся с чистого листа. Ничего, кроме экономии, здесь не хранится.
 */

const FILE = '.docdd/sessions.json';

function pathOf(root: string): string {
  return join(normalizeRoot(root), FILE);
}

function read(root: string): Record<string, string> {
  const path = pathOf(root);
  if (!existsSync(path)) return {};
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    // Испорченная память — не беда: заход пойдёт с чистого листа.
    return {};
  }
}

export function sessionOf(root: string, id: string): string | undefined {
  const found = read(root)[id];
  return typeof found === 'string' && found !== '' ? found : undefined;
}

export function rememberSession(root: string, id: string, sessionId: string): void {
  if (sessionId === '') return;
  const path = pathOf(root);
  const all = { ...read(root), [id]: sessionId };
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
  } catch {
    // Не записалось — следующий заход начнётся заново. Терять тут нечего.
  }
}

export function forgetSession(root: string, id: string): void {
  const all = read(root);
  if (!(id in all)) return;
  delete all[id];
  try {
    writeFileSync(pathOf(root), `${JSON.stringify(all, null, 2)}\n`, 'utf8');
  } catch {
    // См. выше: память расходная.
  }
}
