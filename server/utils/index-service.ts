import { readCache, writeCache } from '../lib/cache';
import { buildIndex } from '../lib/indexer';
import type { ProjectIndex } from '../lib/types';
import { readManifest, readWorkspace } from '../lib/workspace';
import { generalRuleRecords } from './rules-service';

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

  // Правила из общих практик складываются с локальными: источники читаются здесь, а не в чистом разборе.
  const { index } = buildIndex(root, new Date(), generalRuleRecords(readManifest(root).sources?.shared ?? []));
  writeCache(root, index);
  return index;
}
