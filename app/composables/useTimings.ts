import type { ProjectTimings, TaskTiming } from '~~/server/lib/timing';
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * Тайминги задач из журнала (ADR-0039, `GET …/timings`): один запрос на экран,
 * все потребители делят ключ кэша. Считает сервер — экран журнал не разбирает.
 */
export function useTimings(projectId: MaybeRefOrGetter<string>) {
  const id = computed(() => toValue(projectId));
  const state = useFetch<ProjectTimings | { error: ApiFailure }>(() => `/api/projects/${id.value}/timings`, {
    key: () => `timings:${id.value}`, server: false, lazy: true
  });
  const failure = computed(() => failureOf(state.data.value));
  const timings = computed(() => (failure.value ? null : (state.data.value as ProjectTimings | null)));
  const byTask = computed(() => new Map<string, TaskTiming>((timings.value?.tasks ?? []).map((task) => [task.id, task])));
  return { ...state, timings, failure, byTask };
}
