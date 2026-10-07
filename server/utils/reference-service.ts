import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { analyze } from '../lib/analyze';
import { approvedMaps, foldMaps, parseMapRecord } from '../lib/maps';
import { normalizeRoot, resolveInside } from '../lib/paths';
import { buildReferenceIndex, sameIndex } from '../lib/reference';
import { referenceEntries } from '../lib/rules';
import { DEVELOPMENT_DIR, RETIRED_STATUSES } from '../lib/types';
import { readWorkspace, sourceReader } from '../lib/workspace';

/**
 * Справочник проекта (docs/13-reference.md): справки и индекс. Индекс — производное
 * от подтверждённых справок и карты кода; приложение собирает его и пишет в файл,
 * руками он не правится.
 */

export interface ReferenceItem {
  id: string;
  title: string;
  summary: string;
  kind: string;
  fetched: string;
  status: string;
  source: string | null;
  stale: boolean;
  path: string;
}

export interface ReferenceReport {
  /** Нет `paths.reference` в манифесте — справочника в проекте нет: экран зовёт завести. */
  enabled: boolean;
  items?: ReferenceItem[];
  index?: { path: string; fresh: boolean; lines: number; undescribedModules: number; exists: boolean };
}

function compute(root: string) {
  const workspace = readWorkspace(root);
  const folder = workspace.manifest.paths?.reference;
  if (!folder) return null;

  const { records } = analyze({ files: workspace.files, manifest: workspace.manifest });
  const codemap = foldMaps(approvedMaps(records).map((record) => ({ id: record.id, change: parseMapRecord(record.body).change }))).codemap;
  const index = buildReferenceIndex({
    references: referenceEntries(records),
    modules: codemap.modules,
    imports: codemap.imports,
    groups: codemap.groups
  });
  const path = `${DEVELOPMENT_DIR}/${folder}/INDEX.md`;
  const staleMs = (workspace.manifest.policy?.reference_stale_days ?? 180) * 86_400_000;
  const now = Date.now();

  const items: ReferenceItem[] = records
    .filter((record) => record.type === 'reference' && record.id && !RETIRED_STATUSES.has(record.status))
    .map((record) => {
      const fetched = record.data['fetched'] ? String(record.data['fetched']).slice(0, 10) : '';
      const time = Date.parse(fetched);
      return {
        id: record.id,
        title: record.title,
        summary: typeof record.data['summary'] === 'string' ? record.data['summary'] : '',
        kind: typeof record.data['kind'] === 'string' ? record.data['kind'] : '',
        fetched,
        status: record.status,
        source: typeof record.data['source'] === 'string' ? record.data['source'] : null,
        stale: !Number.isNaN(time) && now - time > staleMs,
        path: record.source.path
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  return { index, path, items };
}

export function referenceReport(root: string): ReferenceReport {
  const normalized = normalizeRoot(root);
  const built = compute(normalized);
  if (!built) return { enabled: false };
  const onDisk = sourceReader(normalized)(built.path);
  return {
    enabled: true,
    items: built.items,
    index: {
      path: built.path,
      exists: onDisk !== null,
      fresh: sameIndex(onDisk, built.index.text),
      lines: built.index.lines,
      undescribedModules: built.index.undescribedModules
    }
  };
}

/**
 * Свежий текст индекса для запросов модели: собирается заново, а не читается с диска,
 * чтобы устаревший файл не уехал в запрос. `null` — справочника в проекте нет.
 */
export function referenceIndexText(root: string): string | null {
  try {
    return compute(normalizeRoot(root))?.index.text ?? null;
  } catch {
    return null;
  }
}

/** Собирает индекс и пишет файл. Справочника нет — `null`, и ничего не пишется. */
export function rebuildReferenceIndex(root: string): ReferenceReport | null {
  const normalized = normalizeRoot(root);
  const built = compute(normalized);
  if (!built) return null;
  const absolute = resolveInside(normalized, built.path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, built.index.text, 'utf8');
  return referenceReport(normalized);
}

/**
 * После изменения справки или карты: индекс пересобирается сам. Ошибка сборки не
 * должна ломать запись, ради которой её позвали, — расхождение покажет предупреждение
 * `reference_index_stale`.
 */
export function refreshReferenceIndex(root: string): void {
  try {
    rebuildReferenceIndex(root);
  } catch {
    // см. выше
  }
}
