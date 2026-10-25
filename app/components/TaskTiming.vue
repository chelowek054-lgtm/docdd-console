<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * Срок, оценка и факт задачи (docs/04-ui.md, «Сроки и время задачи», ADR-0039).
 * Срок и оценку ставит человек; факт — из журнала, его не поставить.
 */
const props = defineProps<{ projectId: string; task: IndexRecord }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();
const { byTask, refresh } = useTimings(() => props.projectId);
const timing = computed(() => byTask.value.get(props.task.id));

const asText = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'string' ? value : '');
const due = ref(asText(props.task.extra['due']));
const estimate = ref(asText(props.task.extra['estimate']));
watch(() => props.task, (task) => { due.value = asText(task.extra['due']); estimate.value = asText(task.extra['estimate']); });
const changed = computed(() => due.value !== asText(props.task.extra['due']) || estimate.value.trim() !== asText(props.task.extra['estimate']));
const tagDue = computed(() => props.task.tags.find((tag) => /^due-\d{4}-\d{2}-\d{2}$/.test(tag)) ?? null);
const busy = ref('');
const failure = ref<ApiFailure | null>(null);

async function call(kind: string, url: string, method: 'PATCH' | 'POST', body: Record<string, unknown>) {
  busy.value = kind;
  failure.value = null;
  try {
    const response = await $fetch(url, { method, body, ignoreResponseError: true });
    const problem = failureOf(response);
    if (problem) failure.value = problem;
    else { emit('changed'); void refresh(); }
  } finally {
    busy.value = '';
  }
}

const save = () => call('save', `/api/projects/${props.projectId}/records/${props.task.id}`, 'PATCH', { due: due.value || null, estimate: estimate.value.trim() || null, version: props.task.version });
const fromTag = () => call('tag', `/api/projects/${props.projectId}/records/${props.task.id}/due-from-tag`, 'POST', {});

const STATUSES = ['backlog', 'ready', 'in_progress', 'in_review'];
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">{{ t('tm.title') }}</h2>
        <DueBadge :timing="timing" />
      </div>
    </template>
    <div class="space-y-3 text-sm">
      <div class="flex flex-wrap items-end gap-3">
        <UFormField :label="t('tm.dueField')"><UInput v-model="due" type="date" class="w-44" /></UFormField>
        <UFormField :label="t('tm.estimateField')" :hint="t('tm.estimateHint')"><UInput v-model="estimate" placeholder="2h" class="w-28" @keyup.enter="save" /></UFormField>
        <UButton v-can="'edit_draft'" :loading="busy === 'save'" :disabled="!changed" @click="save">{{ t('tm.save') }}</UButton>
        <UButton v-if="tagDue" v-can="'edit_draft'" variant="soft" icon="i-lucide-calendar-arrow-down" :loading="busy === 'tag'" @click="fromTag">{{ t('tm.fromTag', { tag: tagDue }) }}</UButton>
      </div>
      <p v-if="failure" class="text-error">{{ failure.message }}</p>

      <dl v-if="timing" class="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-4">
        <div><dt class="text-muted">{{ t('tm.lead') }}</dt><dd>{{ spanLabel(timing.leadMinutes) }}</dd></div>
        <div><dt class="text-muted">{{ t('tm.cycle') }}</dt><dd>{{ spanLabel(timing.cycleMinutes) }}</dd></div>
        <div><dt class="text-muted">{{ t('tm.waitingDocs') }}</dt><dd>{{ spanLabel(timing.waitingDocsMinutes) }}</dd></div>
        <div><dt class="text-muted">{{ t('tm.estimateVsFact') }}</dt><dd>{{ spanLabel(timing.estimateMinutes) }} / {{ spanLabel(timing.factMinutes) }}</dd></div>
        <div v-for="status in STATUSES" :key="status"><dt class="text-muted">{{ statusLabel(status) }}</dt><dd>{{ spanLabel(timing.inStatus[status] ?? 0) }}</dd></div>
      </dl>
      <p v-if="timing && !timing.precise" class="text-xs text-muted">{{ t('tm.imprecise') }}</p>
    </div>
  </UCard>
</template>
