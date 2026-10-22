<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';
import type { CapabilityLike } from '~~/server/lib/functional';
import { customerSummary, roadmap } from '~~/server/lib/manager';

/** Сводка для заказчика (T-0035): возможности карты простым языком, копирование и выгрузка в Markdown. */
const props = defineProps<{ projectId: string; projectName: string; records: IndexRecord[] }>();
const { t } = useT();

const { data } = useFetch<{ functional?: { capabilities: CapabilityLike[] } }>(() => `/api/projects/${props.projectId}/map`, { query: { kind: 'functional' }, server: false, lazy: true });
const today = new Date().toISOString().slice(0, 10);
const markdown = computed(() => customerSummary(props.projectName, today, data.value?.functional?.capabilities ?? [], roadmap(props.records, today)));

const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(markdown.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* буфер недоступен — остаётся выгрузка */ }
}

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
    <div class="flex flex-wrap gap-2">
      <UButton :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" variant="soft" @click="copy">{{ copied ? t('ms.copied') : t('ms.copy') }}</UButton>
      <UButton icon="i-lucide-download" variant="soft" color="neutral" @click="download">{{ t('ms.download') }}</UButton>
    </div>
    <UCard>
      <pre class="whitespace-pre-wrap font-sans text-sm leading-relaxed">{{ markdown }}</pre>
    </UCard>
  </div>
</template>
