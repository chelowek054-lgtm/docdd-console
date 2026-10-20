import type { Ref } from 'vue';
import { reviewerOf, roleName, type ReviewerPick } from '~~/server/lib/reviewer';
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
    return new Map<string, ReviewerPick | null>(tasks.value.map((task) => [task.id, reviewerOf(task, records, roles.value)]));
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
