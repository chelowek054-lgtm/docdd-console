<script setup lang="ts">
import { draftsFromCriteria, parseCriteria } from '~~/server/lib/criteria';
import type { IndexRecord } from '~~/server/lib/types';
const { t } = useT();

/**
 * Критерии приёмки требования и черновики проверок из них (T-0037). Черновики
 * заводятся обычным созданием записи — id выдаёт сервер, статус draft.
 */
const props = defineProps<{ projectId: string; recordId: string; body: string; records: readonly IndexRecord[] }>();
const emit = defineEmits<{ created: [] }>();

const criteria = computed(() => parseCriteria(props.body));
const existing = computed(() => props.records.filter((r) => r.type === 'verification' && (r.links.verifies ?? []).includes(props.recordId)).map((r) => r.title));
const drafts = computed(() => draftsFromCriteria(props.recordId, criteria.value, existing.value));
const busy = ref(false);
const failure = ref('');

async function create() {
  busy.value = true;
  failure.value = '';
  try {
    for (const draft of drafts.value) {
      await $fetch(`/api/projects/${props.projectId}/records`, { method: 'POST', body: { type: 'verification', title: draft.title, kind: draft.kind, links: { verifies: [draft.verifies] } } });
    }
    emit('created');
  } catch {
    failure.value = t('t83.m4.rc.fail');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard v-if="criteria.length > 0">
    <template #header>{{ t('t83.record-criteria.1', { length: criteria.length }) }}</template>
    <ul class="list-disc pl-5 text-sm">
      <li v-for="item in criteria" :key="item">{{ item }}</li>
    </ul>
    <div class="mt-3 flex items-center gap-3">
      <UButton :disabled="drafts.length === 0" :loading="busy" @click="create">{{ t('t83.record-criteria.2', { length: drafts.length }) }}</UButton>
      <span v-if="drafts.length === 0" class="text-xs text-muted">{{ t('t83.record-criteria.3') }}</span>
      <span v-if="failure" class="text-xs text-error">{{ failure }}</span>
    </div>
  </UCard>
</template>
