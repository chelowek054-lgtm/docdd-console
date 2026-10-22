<script setup lang="ts">
import type { IndexRecord, VerificationOutcome } from '~~/server/lib/types';

/**
 * «Завести дефект» из проваленной проверки (R-0063): заготовка получает связь
 * `found_by` на проверку и `breaks` на требования, которые та проверяет.
 * Показывается только при результате «провалена».
 */
/** `attachments` — вложения последнего прогона: их пути переходят в запись дефекта (R-0099). */
const props = defineProps<{ projectId: string; record: IndexRecord; result?: VerificationOutcome | undefined; attachments?: string[] }>();

const SEVERITIES = [
  { label: 'Блокирующий', value: 'blocker' },
  { label: 'Критичный', value: 'critical' },
  { label: 'Значительный', value: 'major' },
  { label: 'Незначительный', value: 'minor' },
  { label: 'Косметический', value: 'trivial' }
];
const title = ref(`Провалена проверка: ${props.record.title}`);
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
    message.value = response.error ? response.error.message : `Заведён дефект ${response.record?.id ?? ''}`;
    if (response.record) await navigateTo(`/projects/${props.projectId}/records/${response.record.id}`);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="result?.state === 'failed'" class="mt-4 space-y-2 border-t border-default pt-3 text-sm">
    <p class="font-medium">Завести дефект</p>
    <UInput v-model="title" class="w-full" placeholder="Заголовок" />
    <USelect v-model="severity" class="w-full" :items="SEVERITIES" />
    <UInput v-model="environment" class="w-full" placeholder="Окружение (ОС, браузер, конфигурация)" />
    <UInput v-model="build" class="w-full" placeholder="Сборка или релиз" />
    <UTextarea v-model="steps" class="w-full" :rows="3" placeholder="Шаги воспроизведения" />
    <UButton :disabled="!title.trim() || busy" :loading="busy" @click="create">Завести дефект</UButton>
    <p v-if="message" class="text-muted">{{ message }}</p>
  </div>
</template>
