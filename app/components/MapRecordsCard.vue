<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

/**
 * Записи, из которых сложены карты (docs/04-ui.md, «Карты»), — аккордеоном, как
 * вектор: список длинный и нужен не всегда. Свёрнут по умолчанию, выбор помнится
 * в браузере; есть черновик на подтверждение — раскрыт сам, иначе его не заметить.
 */
const props = defineProps<{ projectId: string; groups: { label: string; records: IndexRecord[] }[]; waiting: number; course?: number }>();
const { t } = useT();

const STORAGE_KEY = 'docdd:map-records-open';
const chosen = ref<boolean | null>(null);
onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) chosen.value = stored === '1';
  } catch { /* хранилище может быть закрыто — действует умолчание */ }
});
const shown = computed(() => props.waiting > 0 || (chosen.value ?? false));
function toggle() {
  chosen.value = !shown.value;
  try {
    localStorage.setItem(STORAGE_KEY, chosen.value ? '1' : '0');
  } catch { /* не страшно: выбор не запомнится */ }
}
const total = computed(() => props.groups.reduce((sum, group) => sum + group.records.length, 0));
</script>

<template>
  <UCard :ui="{ header: shown ? '' : 'border-b-0', body: shown ? '' : 'hidden' }">
    <template #header>
      <button type="button" class="flex min-w-0 items-start gap-2 text-left" :aria-expanded="shown" @click="toggle">
        <UIcon :name="shown ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="mt-1 size-4 shrink-0" />
        <span>
          <span class="block font-medium">{{ t('maps.records.title') }}</span>
          <span class="block text-sm text-muted">{{ t('maps.records.hint', { n: total }) }}</span>
        </span>
      </button>
    </template>
    <p v-if="course" class="mb-2 text-xs text-muted">{{ t('maps.records.course', { n: course }) }}</p>
    <div class="space-y-1 text-sm">
      <p v-for="group in groups" :key="group.label" class="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span class="text-muted">{{ group.label }}:</span>
        <RecordLink v-for="record in group.records" :key="record.id" :project-id="projectId" :record-id="record.id" :record="record" />
      </p>
    </div>
  </UCard>
</template>
