<script setup lang="ts">
import type { IndexRecord } from '../../server/lib/types';
const { t } = useT();

/**
 * Две общие шкалы проекта: задачи и фазы (docs/04-ui.md, «Общие шкалы»).
 * Записи приходят все, без фильтров экрана, — шкала про проект, а не про
 * выбранное.
 */
const props = defineProps<{ records: readonly IndexRecord[] }>();

const overall = computed(() => overallProgress(props.records));

const bars = computed(() => [
  { key: 'tasks', label: t('t83.m4.op.tasks'), empty: t('t83.m4.op.noTasks'), share: overall.value.tasks },
  { key: 'phases', label: t('t83.m4.op.phases'), empty: t('t83.m4.op.noPhases'), share: overall.value.phases }
]);
</script>

<template>
  <div class="grid gap-4 ds-card p-4 sm:grid-cols-2">
    <div v-for="bar in bars" :key="bar.key">
      <div class="flex items-baseline justify-between gap-3">
        <span class="text-sm font-medium">{{ bar.label }}</span>
        <span class="text-sm text-muted">
          <template v-if="bar.share.total">
            {{ t('t83.overall-progress.1', { done: bar.share.done, total: bar.share.total, p: percent(bar.share.done, bar.share.total) }) }}
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
        <div class="h-full bg-primary" :style="{ width: `${percent(bar.share.done, bar.share.total)}%` }" />
      </div>
    </div>
  </div>
</template>
