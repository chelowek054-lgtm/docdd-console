<script setup lang="ts">
import type { TaskTiming } from '~~/server/lib/timing';

/**
 * Срок и время задачи одной строкой (docs/04-ui.md, «Сроки и время задачи»):
 * «просрочена на N дн.» / «осталось N дн.», оценка и факт по журналу.
 */
const props = defineProps<{ timing?: TaskTiming | undefined }>();
const { t } = useT();

const due = computed(() => {
  const timing = props.timing;
  if (!timing?.due) return null;
  if (timing.overdueDays > 0) return { color: 'error' as const, label: t('tm.overdue', { n: timing.overdueDays }) };
  if (timing.daysLeft === null) return { color: 'neutral' as const, label: t('tm.due', { date: timing.due }) };
  if (timing.daysLeft === 0) return { color: 'warning' as const, label: t('tm.today') };
  return { color: timing.daysLeft <= 2 ? ('warning' as const) : ('neutral' as const), label: t('tm.left', { n: timing.daysLeft }) };
});
</script>

<template>
  <span v-if="timing && (due || timing.estimateMinutes || timing.factMinutes)" class="inline-flex flex-wrap items-center gap-2">
    <LightBadge v-if="due" :color="due.color" variant="subtle" :title="timing.due ?? ''">{{ due.label }}</LightBadge>
    <span v-if="timing.estimateMinutes || timing.factMinutes" class="text-xs text-muted">
      <template v-if="timing.estimateMinutes">{{ t('tm.estimate') }} {{ spanLabel(timing.estimateMinutes) }} · </template>{{ t('tm.fact') }} {{ spanLabel(timing.factMinutes) }}
    </span>
  </span>
</template>
