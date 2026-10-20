<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';
import type { CapabilityLike } from '~~/server/lib/functional';
import { customerSummary, roadmap } from '~~/server/lib/manager';

/** Сводка для заказчика (T-0035): возможности карты простым языком и выгрузка в Markdown. */
const props = defineProps<{ projectId: string; projectName: string; records: IndexRecord[] }>();

const { data } = useFetch<{ functional?: { capabilities: CapabilityLike[] } }>(() => `/api/projects/${props.projectId}/map`, { query: { kind: 'functional' }, server: false, lazy: true });
const today = new Date().toISOString().slice(0, 10);
const markdown = computed(() => customerSummary(props.projectName, today, data.value?.functional?.capabilities ?? [], roadmap(props.records, today)));

function download() {
  const url = URL.createObjectURL(new Blob([markdown.value], { type: 'text/markdown;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `summary-${today}.md`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div class="space-y-3">
    <UButton @click="download">Выгрузить в Markdown</UButton>
    <pre class="whitespace-pre-wrap rounded border border-default p-3 text-sm">{{ markdown }}</pre>
  </div>
</template>
