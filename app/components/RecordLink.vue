<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types'; const { t } = useT();

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
         обязана выглядеть иначе, чем рабочая. `undefined` — индекс ещё грузится:
         тогда только номер, иначе на миг загорается ложное «записи нет». -->
    <UBadge v-else-if="props.record === null" color="error" variant="subtle" size="sm">{{ t('t83.record-link.1') }}</UBadge>
  </NuxtLink>
</template>
