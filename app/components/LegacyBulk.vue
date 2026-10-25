<script setup lang="ts">
import type { ApiFailure, BulkMoved } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * «В legacy» на списках (A-0001, docs/04-ui.md, «Массовые действия»): одна
 * причина на всю пачку, необязательная карта смены курса и порог «не позже».
 * Пропущенные — в отчёте с причиной, как у «Вперёд»/«Назад».
 */
const props = defineProps<{ projectId: string; selected: IndexRecord[]; actor: string }>();
const emit = defineEmits<{ done: [results?: BulkMoved[]] }>();
const { t } = useT();

const open = ref(false);
const reason = ref('');
const legacyBy = ref('');
const before = ref('');
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);
const report = ref<{ moved: number; skipped: number; results: { id: string; ok: boolean; code?: string; message?: string }[] } | null>(null);

async function run() {
  busy.value = true;
  failure.value = null;
  report.value = null;
  try {
    const response = await $fetch<typeof report.value | { error: ApiFailure }>(`/api/projects/${props.projectId}/records/bulk/legacy`, {
      method: 'POST',
      body: {
        ids: props.selected.map((record) => record.id),
        reason: reason.value,
        legacy_by: legacyBy.value.trim() || null,
        before: before.value.trim() || null,
        actor: props.actor,
        versions: Object.fromEntries(props.selected.map((record) => [record.id, record.version]))
      },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) { failure.value = problem; return; }
    report.value = response as NonNullable<typeof report.value>;
    open.value = false;
    emit('done');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="contents">
    <UButton v-can="'approve'" size="sm" variant="soft" color="neutral" icon="i-lucide-archive" :title="t('lg.bulkTitle')" :disabled="selected.length === 0" @click="open = !open">{{ t('lg.bulk') }}</UButton>
    <div v-if="open" class="flex w-full flex-wrap items-end gap-2 rounded-md border border-default p-2">
      <UFormField :label="t('lg.reason')" class="min-w-64 flex-1"><UInput v-model="reason" :placeholder="t('lg.reasonHint')" class="w-full" /></UFormField>
      <UFormField :label="t('lg.map')"><UInput v-model="legacyBy" placeholder="M-0042" class="w-28" /></UFormField>
      <UFormField :label="t('lg.before')" :hint="t('lg.beforeHint')"><UInput v-model="before" placeholder="2026-10-01 / M-0042" class="w-44" /></UFormField>
      <UButton :loading="busy" :disabled="!reason.trim()" @click="run">{{ t('lg.run', { n: selected.length }) }}</UButton>
    </div>
    <p v-if="failure" class="w-full text-sm text-error">{{ failure.message }}</p>
    <UAlert v-if="report" class="w-full" :color="report.skipped ? 'warning' : 'success'" variant="subtle" icon="i-lucide-archive" :title="t('lg.done', { moved: report.moved, total: report.results.length })" close @update:open="report = null">
      <template v-if="report.skipped" #description>
        <ul class="space-y-1">
          <li v-for="item in report.results.filter((result) => !result.ok)" :key="item.id"><span class="font-mono">{{ item.id }}</span> <code class="text-xs">{{ item.code }}</code> — {{ item.message }}</li>
        </ul>
      </template>
    </UAlert>
  </div>
</template>
