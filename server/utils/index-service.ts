import { readCache, writeCache } from '../lib/cache';
import { buildIndex } from '../lib/indexer';
import type { ProjectIndex } from '../lib/types';
import { readWorkspace } from '../lib/workspace';

/**
 * Индекс пересобирается, когда изменился отпечаток файлов. Кэш производный:
 * при его отсутствии всё работает, просто медленнее.
 */
export function loadIndex(root: string, refresh = false): ProjectIndex {
  if (!refresh) {
    // Папку всё равно приходится обойти: без отпечатка не понять, свеж ли кэш.
    const workspace = readWorkspace(root);
    const cached = readCache(root, workspace.fingerprint);
    if (cached) return cached;
  }

  const { index } = buildIndex(root);
  writeCache(root, index);
  return index;
}
