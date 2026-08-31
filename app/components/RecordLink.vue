<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

const props = defineProps<{
  projectId: string;
  recordId: string;
  record?: IndexRecord | null;
  showType?: boolean;
}>();
</script>

<template>
  <NuxtLink
    :to="`/projects/${props.projectId}/records/${props.recordId}`"
    class="inline-flex items-center gap-2 hover:underline"
  >
    <span class="font-mono text-sm">{{ props.recordId }}</span>
    <span v-if="props.record" class="truncate">{{ props.record.title }}</span>
    <!-- Ссылка на несуществующую запись — это нарушение link_broken, и она
         обязана выглядеть иначе, чем рабочая. -->
    <UBadge v-else color="error" variant="subtle" size="sm">записи нет</UBadge>
  </NuxtLink>
</template>
