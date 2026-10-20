import type { Ref } from 'vue';
import { buildRecordsLookup, reviewerOf, roleName, type ReviewerPick } from '~~/server/lib/reviewer';
import type { IndexRecord, ProjectIndex } from '~~/server/lib/types';

/**
 * Ревьюер у каждой задачи списка и фильтр по нему (docs/adr/0030-task-reviewer.md):
 * у роли своя очередь приёмки.
 */
export function useTaskReviewers(tasks: Ref<IndexRecord[]>, index: Ref<ProjectIndex | null | undefined>) {
  const reviewer = ref<string>('');
  const roles = computed(() => index.value?.project.roles ?? []);
  const picks = computed(() => {
    const records = index.value?.records ?? [];
    // Индекс строим один раз на все задачи, а не перебираем записи на каждой.
    const lookup = buildRecordsLookup(records);
    return new Map<string, ReviewerPick | null>(tasks.value.map((task) => [task.id, reviewerOf(task, records, roles.value, lookup)]));
  });
  const reviewers = computed(() => [...new Set([...picks.value.values()].map((pick) => pick?.role ?? '').filter(Boolean))]
    .sort()
    .map((role) => ({ label: roleName(role, roles.value), value: role })));
  const matches = (task: IndexRecord) => !reviewer.value || picks.value.get(task.id)?.role === reviewer.value;
  const label = (task: IndexRecord) => {
    const pick = picks.value.get(task.id);
    return pick ? roleName(pick.role, roles.value) : '';
  };
  return { reviewer, reviewers, matches, label, picks };
}
