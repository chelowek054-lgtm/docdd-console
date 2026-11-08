import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ProposedRecord } from '~~/server/lib/inbox';
import { offVector } from '~~/server/lib/prompt';

/**
 * Предложение модели перед заведением записей: разбор ответа, снятие пунктов, заведение черновиков.
 * Один путь у намерения на стратегии (ADR-0037) и у допроса (R-0115): номера и файлы — у сервера.
 */
export function useProposal(projectId: () => string) {
  const proposed = ref<ProposedRecord[]>([]);
  const dropped = ref<string[]>([]);
  const problems = ref<string[]>([]);
  const created = ref<{ id: string; title: string }[]>([]);
  const outside = ref<string | null>(null);
  const outsideOk = ref(false);
  const trouble = ref<ApiFailure | null>(null);
  const saving = ref(false);

  const kept = computed(() => proposed.value.filter((record) => !dropped.value.includes(record.key)));

  function reset() {
    trouble.value = null; proposed.value = []; dropped.value = []; problems.value = []; created.value = [];
    outside.value = null; outsideOk.value = false;
  }

  async function preview(answer: string) {
    outside.value = offVector(answer);
    const parsed = await $fetch<{ records: ProposedRecord[]; problems: string[] } | { error: ApiFailure }>(`/api/projects/${projectId()}/inbox/preview`, {
      method: 'POST', body: { answer }, ignoreResponseError: true
    });
    if (failureOf(parsed)) { trouble.value = failureOf(parsed); return; }
    const result = parsed as { records: ProposedRecord[]; problems: string[] };
    proposed.value = result.records;
    problems.value = result.problems;
  }

  /** Заводит то, что человек оставил. Истина — ответ сервера: заведённого могло оказаться меньше. */
  async function create(records: readonly ProposedRecord[], notes: readonly string[]): Promise<boolean> {
    saving.value = true; trouble.value = null;
    try {
      const response = await $fetch<{ created: { id: string; title: string }[]; problems: string[] } | { error: ApiFailure }>(`/api/projects/${projectId()}/inbox/records`, {
        method: 'POST', body: { records, notes }, ignoreResponseError: true
      });
      if (failureOf(response)) { trouble.value = failureOf(response); return false; }
      const result = response as { created: { id: string; title: string }[]; problems: string[] };
      created.value = result.created; problems.value = result.problems; proposed.value = [];
      return true;
    } finally {
      saving.value = false;
    }
  }

  function toggle(key: string) {
    dropped.value = dropped.value.includes(key) ? dropped.value.filter((item) => item !== key) : [...dropped.value, key];
  }

  return { proposed, dropped, problems, created, outside, outsideOk, trouble, saving, kept, reset, preview, create, toggle };
}
