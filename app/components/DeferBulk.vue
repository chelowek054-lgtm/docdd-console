<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * «В бэклог» и «Вернуть в работу» пачкой (R-0105, docs/04-ui.md): одна причина на
 * пачку; пропущенные — в отчёте с причиной.
 */
const props = defineProps<{ projectId: string; selected: IndexRecord[]; actor: string; direction: 'defer' | 'return' }>();
const emit = defineEmits<{ done: [] }>();
const { t } = useT();

const open = ref(false);
const reason = ref('');
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);
const report = ref<{ moved: number; skipped: number; results: { id: string; ok: boolean; code?: string; message?: string }[] } | null>(null);
const label = computed(() => (props.direction === 'defer' ? t('bl.defer') : t('bl.return')));

async function run() {
  busy.value = true;
  failure.value = null;
  report.value = null;
  try {
    const response = await $fetch<typeof report.value | { error: ApiFailure }>(`/api/projects/${props.projectId}/records/bulk/deferred`, {
      method: 'POST',
      body: { ids: props.selected.map((record) => record.id), direction: props.direction, reason: reason.value, actor: props.actor, versions: Object.fromEntries(props.selected.map((record) => [record.id, record.version])) },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) { failure.value = problem; return; }
    report.value = response as NonNullable<typeof report.value>;
    open.value = false;
    reason.value = '';
    emit('done');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="contents">
    <UButton v-can="'approve'" size="sm" variant="soft" color="neutral" :icon="direction === 'defer' ? 'i-lucide-inbox' : 'i-lucide-undo-2'" :title="t('bl.title')" :disabled="selected.length === 0" @click="open = !open">{{ label }}</UButton>
    <div v-if="open" class="flex w-full flex-wrap items-end gap-2 rounded-md border border-default p-2">
      <UFormField :label="t('bl.reason')" class="min-w-64 flex-1"><UInput v-model="reason" :placeholder="t('bl.reasonHint')" class="w-full" @keyup.enter="run" /></UFormField>
      <UButton :loading="busy" @click="run">{{ t('bl.run', { n: selected.length }) }}</UButton>
    </div>
    <p v-if="failure" class="w-full text-sm text-error">{{ failure.message }}</p>
    <UAlert v-if="report" class="w-full" :color="report.skipped ? 'warning' : 'success'" variant="subtle" icon="i-lucide-inbox" :title="t('bl.done', { what: label, moved: report.moved, total: report.results.length })" close @update:open="report = null">
      <template v-if="report.skipped" #description>
        <ul class="space-y-1">
          <li v-for="item in report.results.filter((result) => !result.ok)" :key="item.id"><span class="font-mono">{{ item.id }}</span> <code class="text-xs">{{ item.code }}</code> — {{ item.message }}</li>
        </ul>
      </template>
    </UAlert>
  </div>
</template>
