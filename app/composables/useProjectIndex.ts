import type { IndexRecord, ProjectEntry, ProjectIndex, RecordDetail } from '~~/server/lib/types';
import type { IssueDto } from '~~/server/lib/types';

/**
 * Обращения к API живут здесь: компоненты не ходят в файловую систему и не
 * знают о путях — только эти вызовы (docs/01-architecture.md).
 */

export interface BulkMoved { id: string; ok: boolean; to: string }

export interface ApiFailure {
  code: string;
  message: string;
  detail?: string;
  /** Перечень того, что мешает: приходит с отказом на переход. */
  blockers?: { code: string; message: string }[];
}

/** Ошибка приходит телом ответа, а не исключением: её надо показать текстом. */
function failureOf(payload: unknown): ApiFailure | null {
  const error = (payload as { error?: ApiFailure } | null)?.error;
  return error && typeof error.message === 'string' ? error : null;
}

export function useProjects() {
  return useFetch<ProjectEntry[] | { error: ApiFailure }>('/api/projects', {
    key: 'projects',
    default: () => []
  });
}

export function useProjectIndex(projectId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(projectId));
  // Нарушения не встраиваем в HTML: индекс идёт с issues=0, а они — отдельным
  // ленивым запросом на клиенте (пока грузятся — пусто, как у покрытия).
  const state = useFetch<ProjectIndex | { error: ApiFailure }>(() => `/api/projects/${id.value}/index`, {
    key: () => `index:${id.value}`,
    query: { issues: 0 },
    watch: [id]
  });
  const issuesState = useFetch<{ issues: IssueDto[] } | { error: ApiFailure }>(() => `/api/projects/${id.value}/issues`, {
    key: () => `issues:${id.value}`,
    server: false,
    lazy: true,
    watch: [id]
  });

  const failure = computed(() => failureOf(state.data.value));
  const index = computed<ProjectIndex | null>(() => {
    if (failure.value) return null;
    const base = state.data.value as ProjectIndex | null;
    if (!base) return null;
    const loaded = issuesState.data.value as { issues?: IssueDto[] } | null;
    return loaded?.issues ? { ...base, issues: loaded.issues } : base;
  });

  const records = computed<IndexRecord[]>(() => index.value?.records ?? []);
  const byType = (type: string) => computed(() => records.value.filter((record) => record.type === type));
  const byId = computed(() => new Map(records.value.map((record) => [record.id, record])));

  const errors = computed(() => (index.value?.issues ?? []).filter((issue) => issue.severity === 'error'));
  const warnings = computed(() => (index.value?.issues ?? []).filter((issue) => issue.severity === 'warning'));

  async function refresh() {
    await $fetch(`/api/projects/${id.value}/index?refresh=1`);
    await Promise.all([state.refresh(), issuesState.refresh()]);
  }

  /**
   * Подставляет запись из ответа маршрута в уже загруженный индекс — без
   * сетевого запроса: смена статуса не должна стоить полного перечитывания.
   * Возвращает прежнюю запись, чтобы вызвавший мог откатить.
   */
  function patchRecord(record: Partial<IndexRecord> & { id: string }): IndexRecord | null {
    const current = state.data.value as ProjectIndex | { error: ApiFailure } | null;
    if (!current || failureOf(current)) return null;
    const list = (current as ProjectIndex).records;
    const at = list.findIndex((item) => item.id === record.id);
    if (at === -1) return null;
    const before = list[at]!;
    const next = list.slice();
    next[at] = { ...before, ...record };
    state.data.value = { ...(current as ProjectIndex), records: next };
    return before;
  }

  /** Итог массового действия: статусы ложатся в список сразу, без запроса. */
  function patchStatuses(results: BulkMoved[]) {
    for (const item of results) if (item.ok) patchRecord({ id: item.id, status: item.to });
  }

  return { ...state, index, failure, records, byType, byId, errors, warnings, refresh, patchRecord, patchStatuses };
}

export function useRecord(projectId: MaybeRefOrGetter<string>, recordId: MaybeRefOrGetter<string>) {
  const project = computed(() => toValue(projectId));
  const record = computed(() => toValue(recordId));
  const state = useFetch<RecordDetail | { error: ApiFailure }>(
    () => `/api/projects/${project.value}/records/${record.value}`,
    { key: () => `record:${project.value}:${record.value}`, watch: [project, record] }
  );

  const failure = computed(() => failureOf(state.data.value));
  const detail = computed(() => (failure.value ? null : (state.data.value as RecordDetail | null)));
  return { ...state, detail, failure };
}

/** Порция длинного списка: «Показать ещё N» вместо отрисовки тысяч строк разом. */
export function useChunked<T>(items: MaybeRefOrGetter<T[]>, step = 100) {
  const limit = ref(step);
  const all = computed(() => toValue(items));
  const visible = computed(() => all.value.slice(0, limit.value));
  const rest = computed(() => Math.max(0, all.value.length - limit.value));
  const more = () => { limit.value += step; };
  // Смена набора (фильтр) начинает список заново.
  watch(() => all.value.length, () => { limit.value = step; });
  return { visible, rest, more, step };
}

export { failureOf };

type Backlinks = IndexRecord['backlinks'];

/** Обратные связи по id записи: ленивый запрос на клиенте, пока грузятся — пусто (индекс в HTML их не несёт). */
export function useBacklinks(projectId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(projectId));
  const state = useFetch<{ backlinks?: Record<string, Backlinks> } | { error: ApiFailure }>(() => `/api/projects/${id.value}/backlinks`, {
    key: () => `backlinks:${id.value}`, server: false, lazy: true, watch: [id]
  });
  const map = computed(() => (state.data.value as { backlinks?: Record<string, Backlinks> } | null)?.backlinks ?? {});
  return (record: IndexRecord): Backlinks => map.value[record.id] ?? record.backlinks ?? {};
}
