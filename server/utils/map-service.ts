import { analyze } from '../lib/analyze';
import {
  annotateEvidenceStatus,
  foldMaps,
  parseMapRecord,
  type MapChange,
  type ProjectMap
} from '../lib/maps';
import { readWorkspace, sourceReader } from '../lib/workspace';

/**
 * Общая картина проекта: подтверждённые карты, сложенные в порядке
 * подтверждения (docs/07-maps.md). Производное — считается заново и нигде не
 * хранится.
 */

export interface ProjectMapResult extends ProjectMap {
  /** Сколько утверждений не прошло сверку свидетельств. */
  unverified: number;
}

export function buildProjectMap(root: string): ProjectMapResult {
  const workspace = readWorkspace(root);
  const result = analyze({
    files: workspace.files,
    manifest: workspace.manifest,
    reports: workspace.reports,
    codeFiles: workspace.codeFiles
  });
  const read = memoizedReader(root);

  const approved = result.records
    .filter((record) => record.type === 'map' && record.status === 'approved' && record.id)
    // Порядок подтверждения известен только по дате правки; при равенстве —
    // по идентификатору, чтобы картина не зависела от обхода папки.
    .sort((a, b) => String(a.data['updated'] ?? '').localeCompare(String(b.data['updated'] ?? ''))
      || a.id.localeCompare(b.id));

  const changes: { id: string; change: MapChange }[] = approved
    .map((record) => ({ id: record.id, change: parseMapRecord(record.body).change }));

  const folded = foldMaps(changes);
  // Сверяем только то, что дожило до сложенной картины: ребро, которое
  // позже перекрыто более новой картой, в счётчик уже не попадает — это то
  // же самое ребро, что видит экран, а не история черновиков поверх него.
  annotateEvidenceStatus(folded, read);
  return { ...folded, unverified: countUnverified(folded) };
}

/** Одно чтение файла на путь за вызов: одно свидетельство читают несколько рёбер. */
function memoizedReader(root: string): (path: string) => string | null {
  const raw = sourceReader(root);
  const cache = new Map<string, string | null>();
  return (path: string) => {
    if (!cache.has(path)) cache.set(path, raw(path));
    return cache.get(path) ?? null;
  };
}

function countUnverified(map: ProjectMap): number {
  let count = 0;
  for (const item of map.codemap.imports) if (item.status !== 'ok') count += 1;
  for (const item of map.dataflow.flows) if (item.status !== 'ok') count += 1;
  for (const item of map.userflow.transitions) if (item.status !== 'ok') count += 1;
  for (const item of map.userflow.calls) if (item.status !== 'ok') count += 1;
  return count;
}
