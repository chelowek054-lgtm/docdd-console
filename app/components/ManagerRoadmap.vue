<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';
import { roadmap, type RoadmapPhase } from '~~/server/lib/manager';

/**
 * Дорожная карта фаз (T-0033) с вехами (T-0034): фазы по `rank`, прогресс задач,
 * чужие задачи, из-за которых фаза стоит, и отклонение от целевой даты.
 */
const props = defineProps<{ projectId: string; records: IndexRecord[] }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

const today = new Date().toISOString().slice(0, 10);
const phases = computed(() => roadmap(props.records, today));
const failure = ref<ApiFailure | null>(null);

/** Состояние фазы одним словом — то, что менеджер ищет глазами первым. */
function state(phase: RoadmapPhase): { label: string; color: 'success' | 'error' | 'primary' | 'neutral' } {
  if (phase.total > 0 && phase.done === phase.total) return { label: t('mr.closed'), color: 'success' };
  if (phase.overdueDays > 0) return { label: t('mr.overdue', { n: phase.overdueDays }), color: 'error' };
  if (phase.target) return { label: t('mr.onTime'), color: 'primary' };
  return { label: t('mr.noTarget'), color: 'neutral' };
}

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
    <p v-if="phases.length === 0" class="text-muted">{{ t('mr.none') }}</p>
    <UCard v-for="phase in phases" :key="phase.id">
      <div class="flex flex-wrap items-center gap-2">
        <span class="w-6 font-mono text-xs text-muted">{{ phase.rank ?? '—' }}</span>
        <NuxtLink :to="`/projects/${projectId}/records/${phase.id}`" class="min-w-0 flex-1 font-medium hover:text-primary">
          <span class="font-mono text-xs text-muted">{{ phase.id }}</span> {{ phase.title }}
        </NuxtLink>
        <UBadge :color="state(phase).color" variant="soft">{{ state(phase).label }}</UBadge>
        <UInput type="date" size="sm" :model-value="phase.target ?? ''" :aria-label="t('mr.target')" @change="setTarget(phase.id, ($event.target as HTMLInputElement).value)" />
      </div>
      <div class="mt-3 flex items-center gap-3">
        <UProgress :model-value="phase.done" :max="Math.max(phase.total, 1)" size="sm" class="flex-1" />
        <span class="shrink-0 text-xs text-muted">{{ t('mr.progress', { done: phase.done, total: phase.total }) }}</span>
      </div>
      <p v-if="phase.blockedBy.length" class="mt-2 flex flex-wrap items-center gap-1 text-sm text-warning">
        {{ t('mr.blocked') }}
        <template v-for="(b, at) in phase.blockedBy" :key="at">
          <NuxtLink :to="`/projects/${projectId}/records/${b.task}`" class="underline">{{ b.task }}</NuxtLink><span class="text-muted">({{ b.phase }})</span>
        </template>
      </p>
    </UCard>
  </div>
</template>
