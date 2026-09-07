import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dropCache } from '../lib/cache';
import { toggleSharedTag } from '../lib/manifest-write';
import { normalizeRoot } from '../lib/paths';
import { availableTagsOf, narrowDomainTypes, sharedRecordsOf, type SharedRecord } from '../lib/shared';
import type { SharedSource } from '../lib/types';
import { developmentDir, MANIFEST_FILE, WorkspaceError } from '../lib/workspace';
import { loadIndex } from './index-service';

/**
 * Чтение общих практик (docs/11-shared-sources.md). Каждый источник — свой,
 * отдельно провалидированный корень: `normalizeRoot(source.path)` не проходит
 * через `resolveInside` корня ЭТОГО проекта — это не выход за его границы, а
 * работа с другим, самостоятельно объявленным корнем, ровно как если бы
 * источник открыли в приложении как обычный проект (docs/01-architecture.md,
 * «Безопасность»).
 */

export interface SharedSourceView {
  path: string;
  tags: string[];
  /** Метка источника для экрана: `[id] D-0007`, чтобы не выглядело решением этого проекта. */
  label: string;
  records: SharedRecord[];
  /** requirement/task/… в источнике — сигнал, что это не источник практик. */
  narrowDomain: string[];
  /** Чем вообще можно подключиться — список для галочек, не только выбранное сейчас. */
  availableTags: string[];
  /** Путь не открылся как DocDD-проект: не найден, не тот контракт, битый манифест. */
  error?: string;
}

export function sharedSourcesOf(sources: readonly SharedSource[]): SharedSourceView[] {
  return sources.map((source) => {
    const tags = source.tags ?? [];
    try {
      const root = normalizeRoot(source.path);
      const index = loadIndex(root);
      return {
        path: source.path,
        tags,
        label: index.project.id,
        records: sharedRecordsOf(index.records, tags),
        narrowDomain: narrowDomainTypes(index.records),
        availableTags: availableTagsOf(index.records)
      };
    } catch (error) {
      const message = error instanceof WorkspaceError ? error.message : String(error);
      return { path: source.path, tags, label: source.path, records: [], narrowDomain: [], availableTags: [], error: message };
    }
  });
}

export type ToggleTagOutcome =
  | { ok: true }
  | { ok: false; code: string; message: string };

/**
 * Галочка на экране «Практики»: включить или выключить тег у источника с
 * этим путём в манифесте ЭТОГО проекта (`root`), не источника. Правит файл
 * человека точечно (server/lib/manifest-write.ts), не пересобирает его.
 */
export function toggleSourceTag(root: string, sourcePath: string, tag: string, enabled: boolean): ToggleTagOutcome {
  const normalized = normalizeRoot(root);
  const manifestPath = join(developmentDir(normalized), MANIFEST_FILE);

  let text: string;
  try {
    text = readFileSync(manifestPath, 'utf8');
  } catch (error) {
    return { ok: false, code: 'manifest_unreadable', message: `Не удалось прочитать манифест: ${String(error)}` };
  }

  const outcome = toggleSharedTag(text, sourcePath, tag, enabled);
  if (!outcome.ok) {
    return { ok: false, code: 'source_not_found', message: outcome.message };
  }

  if (outcome.text !== text) {
    writeFileSync(manifestPath, outcome.text, 'utf8');
    dropCache(normalized);
  }

  return { ok: true };
}
