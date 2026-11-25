<script setup lang="ts">
import type { ChatDraft } from '~/utils/chat-draft';
import type { IndexRecord, RecordDetail } from '~~/server/lib/types';

const props = defineProps<{ projectId: string; draft: ChatDraft; contextTokens?: string[] }>();
const emit = defineEmits<{ changed: [draft: ChatDraft] }>();
const { t } = useT();
const { index, refresh: refreshIndex } = useProjectIndex(() => props.projectId);
const { me, allowed } = useMe(() => props.projectId);
const base = computed(() => `/api/projects/${encodeURIComponent(props.projectId)}`);
const recordId = computed(() => props.draft.recordId);
const detail = shallowRef<RecordDetail>();
const reviewedVersion = ref<string>();
const saving = ref(false);
const error = ref('');
const canCreate = computed(() => !me.value.required || Boolean(me.value.can && allowed('edit_draft').allowed));
const actions = computed(() => detail.value?.actions.filter(({ status }) =>
  status === 'ready' || status === 'review' || (status === 'approved' && Boolean(reviewedVersion.value && reviewedVersion.value === detail.value?.record.version))) ?? []);

async function load() {
  const id = recordId.value;
  reviewedVersion.value = undefined;
  if (!id) return;
  try {
    const loaded = await $fetch<RecordDetail>(`${base.value}/records/${encodeURIComponent(id)}`);
    if (recordId.value === id) detail.value = loaded;
  } catch {
    error.value = t('chat.failedStage');
  }
}
watch([base, recordId], load, { immediate: true });

async function create() {
  if (saving.value || recordId.value || props.draft.rejected || !canCreate.value) return;
  saving.value = true;
  error.value = '';
  const draft = props.draft;
  try {
    const result = await $fetch<{ record?: IndexRecord; error?: { message: string } }>(
      base.value + (draft.type === 'map' ? '/map/draft' : '/records'),
      {
        method: 'POST',
        body: draft.type === 'map'
          ? { title: draft.title, answer: draft.body, source: 'model', contextTokens: props.contextTokens ?? [] }
          : { type: 'task', title: draft.title, body: draft.body },
        ignoreResponseError: true
      });
    if (result.record) {
      emit('changed', { ...draft, recordId: result.record.id });
      void refreshIndex();
    } else error.value = result.error?.message ?? t('chat.failedStage');
  } catch {
    error.value = t('chat.failedStage');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="space-y-3 rounded-lg border border-default bg-default p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-medium">{{ draft.title }}</h3>
      <UBadge v-if="draft.rejected" color="neutral" variant="soft">{{ t('chat.rejected') }}</UBadge>
      <NuxtLink v-else-if="recordId" class="text-sm text-primary hover:underline"
        :to="`/projects/${encodeURIComponent(projectId)}/records/${encodeURIComponent(recordId)}`">{{ recordId }}</NuxtLink>
      <UBadge v-else color="neutral" variant="soft">{{ t('chat.proposal') }}</UBadge>
    </div>
    <template v-if="!draft.rejected">
      <details class="text-sm">
        <summary class="cursor-pointer text-muted">{{ t('chat.preview') }}</summary>
        <pre class="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words">{{ detail?.body ?? draft.body }}</pre>
      </details>
      <p v-if="error" class="text-sm text-error" role="status">{{ error }}</p>
      <div v-if="!recordId" class="flex flex-wrap gap-2">
        <UButton size="xs" :loading="saving" :disabled="!canCreate" @click="create">{{ t('chat.createDraft') }}</UButton>
        <UButton size="xs" color="neutral" variant="ghost" :disabled="saving" @click="emit('changed', { ...draft, rejected: true })">{{ t('chat.reject') }}</UButton>
      </div>
      <template v-else-if="detail">
        <StatusBadge :status="detail.record.status" :type="detail.record.type" />
        <RecordDiff :key="detail.record.version ?? detail.record.status" :project-id="projectId" :record-id="recordId" :status="detail.record.status"
          :type="detail.record.type" @viewed="reviewedVersion = detail?.record.version" />
        <RecordActions v-if="actions.length" :project-id="projectId" :record-id="recordId" :version="detail.record.version"
          :actions="actions" :roles="index?.project.roles ?? []" @changed="load(); refreshIndex()" />
      </template>
    </template>
  </section>
</template>
