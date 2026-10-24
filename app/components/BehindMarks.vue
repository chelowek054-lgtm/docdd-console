<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { BehindProposal } from '~~/server/lib/coverage';

/**
 * «Отметить по фактам» (R-0101, docs/07-maps.md): возможности, все задачи которых
 * закрыты, а отметка отстала. Кнопка заводит один черновик карты на подтверждение —
 * отметку меняет подтверждение человеком, а не она.
 */
const props = defineProps<{ projectId: string }>();
const { t } = useT();

const { data, refresh } = useFetch<{ proposals: BehindProposal[] }>(() => `/api/projects/${props.projectId}/map/behind`, {
  key: () => `behind:${props.projectId}`,
  server: false,
  lazy: true
});
const proposals = computed(() => data.value?.proposals ?? []);

const open = ref(false);
const chosen = ref<Record<string, 'implemented' | 'partial' | null>>({});
const saving = ref(false);
const failure = ref<ApiFailure | null>(null);
const draft = ref<string | null>(null);

function start() {
  chosen.value = Object.fromEntries(proposals.value.map((item) => [item.id, item.status]));
  failure.value = null;
  draft.value = null;
  open.value = true;
}

const picked = computed(() => proposals.value.filter((item) => chosen.value[item.id]));
const statusItems = computed(() => [
  { label: t('bm.implemented'), value: 'implemented' },
  { label: t('bm.partial'), value: 'partial' }
]);

function toggle(id: string, on: boolean, proposed: 'implemented' | 'partial') {
  chosen.value = { ...chosen.value, [id]: on ? proposed : null };
}

async function create() {
  saving.value = true;
  failure.value = null;
  try {
    const statuses = picked.value.map((item) => ({ id: item.id, status: chosen.value[item.id], note: item.note }));
    const response = await $fetch(`/api/projects/${props.projectId}/map/capability`, { method: 'POST', body: { action: 'status', statuses }, ignoreResponseError: true });
    const problem = failureOf(response);
    if (problem) { failure.value = problem; return; }
    draft.value = (response as { record?: { id: string } }).record?.id ?? null;
    await refresh();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="proposals.length || draft">
    <UAlert v-if="proposals.length" color="warning" variant="subtle" icon="i-lucide-clock-alert" :title="t('bm.title', { n: proposals.length })" :description="t('bm.hint')">
      <template #actions>
        <UButton v-can="'edit_draft'" size="sm" color="warning" icon="i-lucide-list-checks" @click="start">{{ t('bm.open') }}</UButton>
      </template>
    </UAlert>

    <UModal v-model:open="open" :title="t('bm.dialog')" :description="t('bm.dialogHint')" :ui="{ content: 'sm:max-w-3xl' }">
      <template #body>
        <div v-if="draft" class="space-y-2 text-sm">
          <p>{{ t('bm.created') }}</p>
          <UButton :to="`/projects/${projectId}/records/${draft}`" icon="i-lucide-file-check" @click="open = false">{{ t('bm.openDraft', { id: draft }) }}</UButton>
        </div>
        <ul v-else class="max-h-[60vh] space-y-2 overflow-y-auto">
          <li v-for="item in proposals" :key="item.id" class="ds-card flex flex-wrap items-start gap-3 p-3">
            <UCheckbox :model-value="!!chosen[item.id]" :aria-label="item.title" @update:model-value="(on: boolean | 'indeterminate') => toggle(item.id, on === true, item.status)" />
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ item.title }} <span class="font-mono text-xs text-muted">{{ item.id }}</span></p>
              <p class="text-xs text-muted">{{ item.note }}</p>
            </div>
            <USelect
              v-if="chosen[item.id]"
              :model-value="chosen[item.id] ?? undefined"
              size="sm"
              class="w-40"
              :items="statusItems"
              @update:model-value="(value: string) => (chosen = { ...chosen, [item.id]: value as 'implemented' | 'partial' })"
            />
          </li>
        </ul>
        <UAlert v-if="failure" class="mt-3" color="error" variant="subtle" :title="failure.message" :description="failure.detail" />
      </template>
      <template v-if="!draft" #footer>
        <div class="flex w-full flex-wrap items-center gap-3">
          <span class="text-sm text-muted">{{ t('bm.picked', { n: picked.length, total: proposals.length }) }}</span>
          <UButton class="ml-auto" :loading="saving" :disabled="!picked.length" icon="i-lucide-file-plus" @click="create">{{ t('bm.create') }}</UButton>
        </div>
      </template>
    </UModal>
  </div>
</template>
