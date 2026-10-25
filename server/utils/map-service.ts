import { analyze } from '../lib/analyze';
import { approvalOf, courseHistory, type CourseEntry } from '../lib/course';
import {
  annotateEvidenceStatus,
  annotatePending,
  approvedMaps,
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
  /** История курса — производное от подтверждённых карт, нигде не хранится. */
  functional: ProjectMap['functional'] & { history: CourseEntry[] };
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

  const approved = approvedMaps(result.records);

  const changes: { id: string; change: MapChange }[] = approved
    .map((record) => ({ id: record.id, change: parseMapRecord(record.body).change }));

  const folded = foldMaps(changes);
  // Сверяем только то, что дожило до сложенной картины: ребро, которое
  // позже перекрыто более новой картой, в счётчик уже не попадает — это то
  // же самое ребро, что видит экран, а не история черновиков поверх него.
  annotateEvidenceStatus(folded, read);
  annotatePending(folded, pendingMapIds(approved, result.records));

  // След правки курса: когда карту подтвердили и кто (docs/07-maps.md,
  // «Источник правды и история курса»). Из записей же, своего журнала нет.
  const approvals = new Map(approved.map((record) => [record.id, approvalOf(record.body, String(record.data['updated'] ?? ''))]));
  const trace = (item: { declaredBy?: string; declaredAt?: string; declaredByRole?: string | null }) => {
    const approval = item.declaredBy ? approvals.get(item.declaredBy) : undefined;
    if (!approval) return;
    item.declaredAt = approval.at;
    item.declaredByRole = approval.by;
  };
  for (const item of folded.functional.capabilities) trace(item);
  if (folded.functional.vision) trace(folded.functional.vision);

  // Сколько записей карта отправила в прежний курс (A-0001): поле `legacy_by` у записей в `legacy`.
  const legacyBy = new Map<string, number>();
  for (const record of result.records) {
    const map = record.data['legacy_by'];
    if (record.status === 'legacy' && typeof map === 'string') legacyBy.set(map, (legacyBy.get(map) ?? 0) + 1);
  }
  const history = courseHistory(approved.map((record, at) => ({
    id: record.id,
    title: record.title,
    approval: approvals.get(record.id) ?? { at: '', by: null },
    change: changes[at]?.change ?? {},
    legacy: legacyBy.get(record.id) ?? 0
  })));
  return {
    ...folded,
    functional: { ...folded.functional, history },
    unverified: countUnverified(folded)
  };
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

export const MAP_KINDS = ['functional', 'codebase', 'flows', 'journeys', 'custom'] as const;
export type MapKind = (typeof MAP_KINDS)[number];

/** Числа для ярлыков вкладок: считаются по полному виду, но отдаются без содержимого других видов. */
export interface MapSummary {
  capabilities: number;
  relations: number;
  modules: number;
  imports: number;
  sources: number;
  flows: number;
  screens: number;
  transitions: number;
  calls: number;
  customNodes: number;
}

/** Ответ `?kind=`: сводка + только запрошенный вид. Остальные части не попадают в ответ вовсе. */
export function mapKindView(full: ProjectMapResult, kind: MapKind): Record<string, unknown> {
  const summary: MapSummary = {
    capabilities: full.functional.capabilities.length,
    relations: full.functional.relations.length,
    modules: full.codemap.modules.length,
    imports: full.codemap.imports.length,
    sources: full.dataflow.sources.length,
    flows: full.dataflow.flows.length,
    screens: full.userflow.screens.length,
    transitions: full.userflow.transitions.length,
    calls: full.userflow.calls.length,
    customNodes: full.custom.nodes.length
  };
  const part: Record<MapKind, Record<string, unknown>> = {
    functional: { functional: full.functional },
    codebase: { codemap: full.codemap },
    flows: { dataflow: full.dataflow },
    journeys: { userflow: full.userflow },
    custom: { custom: full.custom }
  };
  return { kind, from: full.from, unverified: full.unverified, summary, ...part[kind] };
}
