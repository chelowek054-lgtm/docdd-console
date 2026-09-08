import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { dropCache } from '../lib/cache';
import { toggleSharedTag } from '../lib/manifest-write';
import { parseRecord } from '../lib/parse';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { availableTagsOf, narrowDomainTypes, sharedRecordsOf, type SharedRecord } from '../lib/shared';
import type { ProjectEntry, SharedSource } from '../lib/types';
import { withoutJournal } from '../lib/write';
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
  /**
   * Источник открыт в приложении как обычный проект — вот его id, чтобы
   * сослаться на конкретную запись (`/projects/:id/records/:recordId`).
   * `null` — источник валиден, но не зарегистрирован: сослаться некуда,
   * пока его не откроют отдельно.
   */
  registeredProjectId: string | null;
  /**
   * То же самое, что реально уйдёт в раздел «Общие практики» запроса модели
   * (docs/09-execution.md), для текущих `tags` этого источника, — предпросмотр
   * на экране (04-ui.md) читает готовый результат, не пересказывает его. Пусто,
   * если тегов не выбрано — тогда и в запросе для этого источника ничего нет.
   */
  preview: ConnectedPractice[];
  /** Путь не открылся как DocDD-проект: не найден, не тот контракт, битый манифест. */
  error?: string;
}

export function sharedSourcesOf(sources: readonly SharedSource[], registered: readonly ProjectEntry[] = []): SharedSourceView[] {
  return sources.map((source) => {
    const tags = source.tags ?? [];
    try {
      const root = normalizeRoot(source.path);
      const index = loadIndex(root);
      const match = registered.find((project) => {
        try {
          return normalizeRoot(project.root) === root;
        } catch {
          return false;
        }
      });
      return {
        path: source.path,
        tags,
        label: index.project.id,
        records: sharedRecordsOf(index.records, tags),
        narrowDomain: narrowDomainTypes(index.records),
        availableTags: availableTagsOf(index.records),
        registeredProjectId: match?.id ?? null,
        preview: connectedPractices([{ path: source.path, tags }])
      };
    } catch (error) {
      const message = error instanceof WorkspaceError ? error.message : String(error);
      return {
        path: source.path,
        tags,
        label: source.path,
        records: [],
        narrowDomain: [],
        availableTags: [],
        registeredProjectId: null,
        preview: [],
        error: message
      };
    }
  });
}

export interface ConnectedPractice {
  /** `id` проекта-источника — та же метка, что и на экране «Практики». */
  label: string;
  id: string;
  type: string;
  title: string;
  /** Текст записи без front matter и раздела «Журнал» — то, что читает модель. */
  body: string;
}

/**
 * Практики, реально подключённые тегами, — с текстом, а не только
 * заголовком: то, что уходит в запрос модели на выполнение задачи
 * (server/utils/work-service.ts, docs/09-execution.md). В отличие от
 * `sharedSourcesOf` (для экрана — довольно id и названия), здесь для
 * каждой подключённой записи читается файл источника.
 */
export function connectedPractices(sources: readonly SharedSource[]): ConnectedPractice[] {
  const result: ConnectedPractice[] = [];

  for (const source of sources) {
    const tags = source.tags ?? [];
    if (tags.length === 0) continue;

    try {
      const root = normalizeRoot(source.path);
      const index = loadIndex(root);
      const matched = sharedRecordsOf(index.records, tags);

      for (const record of matched) {
        const full = index.records.find((item) => item.id === record.id);
        if (!full) continue;

        const text = readSourceFile(root, full.path);
        if (text === null) continue;

        const parsed = parseRecord(text, { path: full.path });
        if (!parsed.ok) continue;

        result.push({
          label: index.project.id,
          id: record.id,
          type: record.type,
          title: record.title,
          body: withoutJournal(parsed.record.body).trim()
        });
      }
    } catch {
      // Источник не открылся — то же самое, что на экране «Практики»
      // становится ошибкой у этого источника; здесь задачу это не должно
      // остановить, поэтому источник просто пропускается.
    }
  }

  return result;
}

function readSourceFile(root: string, relativePath: string): string | null {
  try {
    return readFileSync(resolveInside(root, relativePath), 'utf8');
  } catch {
    return null;
  }
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
