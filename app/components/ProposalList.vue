<script setup lang="ts">
import type { ProposedRecord } from '~~/server/lib/inbox';

/** Список предложенных записей со снятием пунктов (ADR-0037, R-0115): карта сверху, задачи последними. */
const props = defineProps<{ records: readonly ProposedRecord[]; dropped: readonly string[] }>();
const emit = defineEmits<{ toggle: [key: string] }>();
const { t } = useT();

const ORDER = ['map', 'requirement', 'verification', 'design', 'decision', 'phase', 'task'];
const rank = (type: string) => (ORDER.includes(type) ? ORDER.indexOf(type) : ORDER.length);
const sorted = computed(() => [...props.records].sort((a, b) => rank(a.type) - rank(b.type)));
</script>

<template>
  <ul class="space-y-1 text-sm">
    <li v-for="record in sorted" :key="record.key" class="flex items-start gap-2" :class="record.type === 'map' ? '' : record.type === 'task' ? 'pl-8' : 'pl-4'">
      <UCheckbox :model-value="!dropped.includes(record.key)" @update:model-value="emit('toggle', record.key)" />
      <UBadge size="sm" variant="subtle" color="neutral">{{ t(`si.type.${record.type}`) }}</UBadge>
      <span>{{ record.title }}</span>
    </li>
  </ul>
</template>
