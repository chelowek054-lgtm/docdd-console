import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { normalizeRoot } from './paths';
import type { ProjectIndex } from './types';

/**
 * Кэш индекса в `.docdd/index.json` внутри проекта. Он производный: его можно
 * удалить, он не попадает в git, и приложение обязано работать при его
 * отсутствии (docs/01-architecture.md).
 */

export const CACHE_FILE = '.docdd/index.json';

export function cachePath(root: string): string {
  return join(normalizeRoot(root), '.docdd', 'index.json');
}

/**
 * Кэш годен, пока совпадает отпечаток файлов. Любое сомнение — пересборка:
 * показать устаревшее состояние хуже, чем перечитать папку.
 */
export function readCache(root: string, fingerprint: string): ProjectIndex | null {
  try {
    const cached: unknown = JSON.parse(readFileSync(cachePath(root), 'utf8'));
    if (!cached || typeof cached !== 'object') return null;
    const index = cached as ProjectIndex;
    return index.fingerprint === fingerprint ? index : null;
  } catch {
    return null;
  }
}

export function writeCache(root: string, index: ProjectIndex): void {
  try {
    const path = cachePath(root);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
  } catch {
    // Кэш — удобство, а не условие работы: не записался, значит в следующий раз
    // соберём заново. Ронять запрос из-за этого не за что.
  }
}

export function dropCache(root: string): void {
  try {
    rmSync(cachePath(root), { force: true });
  } catch {
    // См. выше: отсутствие кэша — нормальное состояние.
  }
}
