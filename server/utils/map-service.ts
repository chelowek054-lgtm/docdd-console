import { analyze } from '../lib/analyze';
import {
  annotateEvidenceStatus,
  annotatePending,
  foldMaps,
  parseMapRecord,
  type MapChange,
  type ProjectMap
} from '../lib/maps';
import type { WorkRecord } from '../lib/types';
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
  annotatePending(folded, pendingMapIds(approved, result.records));
  return { ...folded, unverified: countUnverified(folded) };
}

/**
 * Карты, которые ещё не «устоялись»: намерение (`intent: true`) или задача,
 * что их меняет (`affects`), не закрыта. Пустой список задач — не блокирует:
 * так же трактует состояние экран одной записи (`records/[recordId].get.ts`)
 * и правило `task_maps_unapproved` (`server/lib/rules.ts`) — карта без единой
 * связанной задачи никогда не заводилась как «код ещё не готов».
 */
export function pendingMapIds(approved: readonly WorkRecord[], allRecords: readonly WorkRecord[]): Set<string> {
  const pending = new Set<string>();
  for (const record of approved) {
    if (record.data['intent'] === true) {
      pending.add(record.id);
      continue;
    }
    const affecting = allRecords.filter(
      (item) => item.type === 'task' && (item.links.affects ?? []).includes(record.id)
    );
    const settled = affecting.every((task) => task.status === 'done' || task.status === 'dropped');
    if (!settled) pending.add(record.id);
  }
  return pending;
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

/** `pending` — сверка ещё не запущена, не провалена: в счётчик не идёт (docs/07-maps.md). */
function countUnverified(map: ProjectMap): number {
  const bad = (item: { status?: string }) => item.status !== 'ok' && item.status !== 'pending';
  let count = 0;
  for (const item of map.codemap.imports) if (bad(item)) count += 1;
  for (const item of map.dataflow.flows) if (bad(item)) count += 1;
  for (const item of map.userflow.transitions) if (bad(item)) count += 1;
  for (const item of map.userflow.calls) if (bad(item)) count += 1;
  return count;
}
