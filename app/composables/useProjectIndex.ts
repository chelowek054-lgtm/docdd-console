import type { IndexRecord, ProjectEntry, ProjectIndex, RecordDetail } from '~~/server/lib/types';

/**
 * Обращения к API живут здесь: компоненты не ходят в файловую систему и не
 * знают о путях — только эти вызовы (docs/01-architecture.md).
 */

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
  const state = useFetch<ProjectIndex | { error: ApiFailure }>(() => `/api/projects/${id.value}/index`, {
    key: () => `index:${id.value}`,
    watch: [id]
  });

  const failure = computed(() => failureOf(state.data.value));
  const index = computed(() => (failure.value ? null : (state.data.value as ProjectIndex | null)));

  const records = computed<IndexRecord[]>(() => index.value?.records ?? []);
  const byType = (type: string) => computed(() => records.value.filter((record) => record.type === type));
  const byId = computed(() => new Map(records.value.map((record) => [record.id, record])));

  const errors = computed(() => (index.value?.issues ?? []).filter((issue) => issue.severity === 'error'));
  const warnings = computed(() => (index.value?.issues ?? []).filter((issue) => issue.severity === 'warning'));

  async function refresh() {
    await $fetch(`/api/projects/${id.value}/index?refresh=1`);
    await state.refresh();
  }

  return { ...state, index, failure, records, byType, byId, errors, warnings, refresh };
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

export { failureOf };
