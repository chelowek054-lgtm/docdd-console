import { normalizeRoot } from '../lib/paths';
import { narrowDomainTypes, sharedRecordsOf, type SharedRecord } from '../lib/shared';
import type { SharedSource } from '../lib/types';
import { WorkspaceError } from '../lib/workspace';
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
        narrowDomain: narrowDomainTypes(index.records)
      };
    } catch (error) {
      const message = error instanceof WorkspaceError ? error.message : String(error);
      return { path: source.path, tags, label: source.path, records: [], narrowDomain: [], error: message };
    }
  });
}
