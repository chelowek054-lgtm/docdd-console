<script setup lang="ts">
import type { CourseEntry } from '~~/server/lib/course';
const { t, tn } = useT();

/**
 * История курса: по строке на подтверждённую карту с функциональным блоком, от
 * новых к старым — когда, кто подтвердил, что изменилось (docs/04-ui.md,
 * «Функциональная карта»). Собирается из записей, своего журнала нет.
 */
const props = defineProps<{
  projectId: string;
  history: CourseEntry[];
}>();

const open = ref(false);

/** «+3 возможности, −1, у 5 сменилось состояние, +2 связи» — только то, что есть. */
function summary(entry: CourseEntry): string {
  const parts: string[] = [];
  if (entry.added) parts.push(`+${tn('t83.m2.pl.cap', entry.added)}`);
  if (entry.removed) parts.push(`−${entry.removed}`);
  if (entry.statusChanged) parts.push(t('t83.m2.ch.state', { n: entry.statusChanged }));
  if (entry.relations) parts.push(tn('t83.m2.pl.rel', entry.relations));
  if (entry.legacy) parts.push(t('lg.course', { n: entry.legacy }));
  return parts.join(', ');
}

const count = computed(() => props.history.length);
</script>

<template>
  <div v-if="count > 0" class="mb-3">
    <UButton
      size="xs"
      variant="ghost"
      color="neutral"
      :icon="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
      @click="open = !open"
    >
      {{ t('t83.course-history.1', { count: count }) }}
    </UButton>

    <ul v-if="open" class="mt-2 space-y-1 border-l border-default pl-3 text-sm">
      <li v-for="entry in history" :key="entry.map" class="flex flex-wrap items-baseline gap-x-2">
        <span class="font-mono text-xs text-muted">{{ entry.at || '—' }}</span>
        <span class="text-xs text-muted">{{ entry.by ?? t('t83.m2.anon') }}</span>
        <NuxtLink :to="`/projects/${projectId}/records/${entry.map}`" class="hover:underline">
          {{ entry.map }} · {{ entry.title }}
        </NuxtLink>
        <span v-if="summary(entry)" class="text-xs text-muted">{{ summary(entry) }}</span>
        <UBadge v-if="entry.vision" size="xs" color="primary" variant="subtle">{{ t('t83.course-history.2') }}</UBadge>
      </li>
    </ul>
  </div>
</template>
