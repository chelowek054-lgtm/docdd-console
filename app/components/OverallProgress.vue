<script setup lang="ts">
import type { IndexRecord } from '../../server/lib/types';

/**
 * Две общие шкалы проекта: задачи и фазы (docs/04-ui.md, «Общие шкалы»).
 * Записи приходят все, без фильтров экрана, — шкала про проект, а не про
 * выбранное.
 */
const props = defineProps<{ records: readonly IndexRecord[] }>();

const overall = computed(() => overallProgress(props.records));

const bars = computed(() => [
  { key: 'tasks', label: 'Задачи', empty: 'задач нет', share: overall.value.tasks },
  { key: 'phases', label: 'Фазы', empty: 'фаз нет', share: overall.value.phases }
]);
</script>

<template>
  <div class="grid gap-4 rounded-lg border border-default p-4 sm:grid-cols-2">
    <div v-for="bar in bars" :key="bar.key">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-sm font-medium">{{ bar.label }}</span>
        <span class="text-sm text-muted">
          <template v-if="bar.share.total">
            закрыто {{ bar.share.done }} из {{ bar.share.total }} · {{ percent(bar.share.done, bar.share.total) }}%
          </template>
          <template v-else>{{ bar.empty }}</template>
        </span>
      </div>
      <div
        class="mt-2 h-2 overflow-hidden rounded-full bg-elevated"
        role="progressbar"
        :aria-label="bar.label"
        :aria-valuenow="percent(bar.share.done, bar.share.total)"
        aria-valuemin="0"
        aria-valuemax="100"
      >
        <div class="h-full bg-success" :style="{ width: `${percent(bar.share.done, bar.share.total)}%` }" />
      </div>
    </div>
  </div>
</template>
