<script setup lang="ts">
import type { IndexRecord, VerificationOutcome } from '~~/server/lib/types';
const { t } = useT();

/**
 * «Завести дефект» из проваленной проверки (R-0063): заготовка получает связь
 * `found_by` на проверку и `breaks` на требования, которые та проверяет.
 * Показывается только при результате «провалена».
 */
/** `attachments` — вложения последнего прогона: их пути переходят в запись дефекта (R-0099). */
const props = defineProps<{ projectId: string; record: IndexRecord; result?: VerificationOutcome | undefined; attachments?: string[] }>();

const SEVERITIES = [
  { get label() { return t('t83.m3.sev.blocker'); }, value: 'blocker' },
  { get label() { return t('t83.m3.sev.critical'); }, value: 'critical' },
  { get label() { return t('t83.m3.sev.major'); }, value: 'major' },
  { get label() { return t('t83.m3.sev.minor'); }, value: 'minor' },
  { get label() { return t('t83.m3.sev.trivial'); }, value: 'trivial' }
];
const title = ref(t('t83.m3.def.title', { title: props.record.title }));
const severity = ref('major');
const environment = ref('');
const build = ref('');
const steps = ref('');
const message = ref('');
const busy = ref(false);

async function create() {
  busy.value = true;
  try {
    const requirements = [...new Set([...(props.record.links.verifies ?? []), ...(props.record.backlinks.verified_by ?? [])])];
    const response = await $fetch<{ record?: IndexRecord; error?: { message: string } }>(`/api/projects/${props.projectId}/records`, {
      method: 'POST',
      body: {
        type: 'defect',
        title: title.value.trim(),
        kind: severity.value,
        environment: environment.value.trim(),
        build: build.value.trim(),
        body: `# ${title.value.trim()}\n\n## Шаги воспроизведения\n\n${steps.value.trim() || '1. …'}\n${(props.attachments ?? []).length ? `\n## Вложения\n\n${(props.attachments ?? []).map((path) => `- ${path}`).join('\n')}\n` : ''}\n## Журнал\n`,
        links: { found_by: [props.record.id], breaks: requirements }
      },
      ignoreResponseError: true
    });
    message.value = response.error ? response.error.message : t('t83.m3.def.made', { id: response.record?.id ?? '' });
    if (response.record) await navigateTo(`/projects/${props.projectId}/records/${response.record.id}`);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="result?.state === 'failed'" class="mt-4 space-y-2 border-t border-default pt-3 text-sm">
    <p class="font-medium">{{ t('t83.defect-from-check.1') }}</p>
    <UInput v-model="title" class="w-full" :placeholder="t('t83.inbox-panel.10')" />
    <USelect v-model="severity" class="w-full" :items="SEVERITIES" />
    <UInput v-model="environment" class="w-full" :placeholder="t('t83.defect-from-check.2')" />
    <UInput v-model="build" class="w-full" :placeholder="t('t83.defect-from-check.3')" />
    <UTextarea v-model="steps" class="w-full" :rows="3" :placeholder="t('t83.defect-from-check.4')" />
    <UButton :disabled="!title.trim() || busy" :loading="busy" @click="create">{{ t('t83.defect-from-check.1') }}</UButton>
    <p v-if="message" class="text-muted">{{ message }}</p>
  </div>
</template>
