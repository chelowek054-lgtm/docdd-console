<script setup lang="ts">
import type { CourseEntry } from '~~/server/lib/course';

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
  if (entry.added) parts.push(`+${plural(entry.added, 'возможность', 'возможности', 'возможностей')}`);
  if (entry.removed) parts.push(`−${entry.removed}`);
  if (entry.statusChanged) parts.push(`у ${entry.statusChanged} сменилось состояние`);
  if (entry.relations) parts.push(`${plural(entry.relations, 'связь', 'связи', 'связей')}`);
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
      История курса · {{ count }}
    </UButton>

    <ul v-if="open" class="mt-2 space-y-1 border-l border-default pl-3 text-sm">
      <li v-for="entry in history" :key="entry.map" class="flex flex-wrap items-baseline gap-x-2">
        <span class="font-mono text-xs text-muted">{{ entry.at || '—' }}</span>
        <span class="text-xs text-muted">{{ entry.by ?? 'автор не указан' }}</span>
        <NuxtLink :to="`/projects/${projectId}/records/${entry.map}`" class="hover:underline">
          {{ entry.map }} · {{ entry.title }}
        </NuxtLink>
        <span v-if="summary(entry)" class="text-xs text-muted">{{ summary(entry) }}</span>
        <UBadge v-if="entry.vision" size="xs" color="primary" variant="subtle">изменён вектор</UBadge>
      </li>
    </ul>
  </div>
</template>
