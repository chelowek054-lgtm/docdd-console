<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';
import { roadmap } from '~~/server/lib/manager';

/**
 * Дорожная карта фаз (T-0033) с вехами (T-0034): фазы по `rank`, прогресс задач,
 * чужие задачи, из-за которых фаза стоит, и отклонение от целевой даты.
 */
const props = defineProps<{ projectId: string; records: IndexRecord[] }>();
const emit = defineEmits<{ changed: [] }>();

const today = new Date().toISOString().slice(0, 10);
const phases = computed(() => roadmap(props.records, today));
const failure = ref<ApiFailure | null>(null);

async function setTarget(id: string, value: string) {
  failure.value = null;
  const response = await $fetch<{ error?: ApiFailure }>(`/api/projects/${props.projectId}/records/${id}/target`, { method: 'POST', body: { target: value }, ignoreResponseError: true });
  if (response?.error) failure.value = response.error;
  else emit('changed');
}
</script>

<template>
  <div class="space-y-3">
    <p v-if="failure" class="text-sm text-error">{{ failure.message }}</p>
    <p v-if="phases.length === 0" class="text-muted">Фаз пока нет.</p>
    <div v-for="phase in phases" :key="phase.id" class="ds-card ds-card--bordered p-3">
      <div class="flex flex-wrap items-baseline gap-2">
        <span class="font-mono text-xs text-muted">{{ phase.rank ?? '—' }}</span>
        <strong>{{ phase.id }} · {{ phase.title }}</strong>
        <span class="text-xs text-muted">{{ phase.done }} из {{ phase.total }}</span>
        <label class="ml-auto text-xs">срок
          <input type="date" :value="phase.target ?? ''" class="rounded border border-default bg-default p-1" @change="setTarget(phase.id, ($event.target as HTMLInputElement).value)">
        </label>
      </div>
      <progress class="my-2 w-full" :value="phase.done" :max="Math.max(phase.total, 1)" />
      <p v-if="phase.overdueDays > 0" class="text-sm text-error">Веха просрочена на {{ phase.overdueDays }} дн.</p>
      <p v-if="phase.blockedBy.length" class="text-sm text-warning">
        Стоит из-за чужих задач: <span v-for="(b, at) in phase.blockedBy" :key="at">{{ b.task }} ({{ b.phase }})<span v-if="at < phase.blockedBy.length - 1">, </span></span>
      </p>
    </div>
  </div>
</template>
