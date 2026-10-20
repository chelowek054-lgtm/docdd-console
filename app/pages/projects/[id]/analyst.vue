<script setup lang="ts">
import type { AnalystMode } from '~~/server/lib/analyst';

/** Помощник аналитика (T-0038): уточнение, противоречия, критерии. Ответ только читается — в документы ничего не пишется. */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { records } = useProjectIndex(projectId);
const requirements = computed(() => records.value.filter((record) => record.type === 'requirement'));
const recordId = ref('');
const mode = ref<AnalystMode>('contradictions');
const answer = ref('');
const failure = ref('');
const { running, elapsed, outcome, stream, cancel } = useModelRequest(() => `${projectId.value}:analyst`, { label: 'Помощник аналитика' });

async function ask() {
  failure.value = '';
  answer.value = '';
  try {
    const built = await $fetch<{ prompt: string }>(`/api/projects/${projectId.value}/analyst`, { method: 'POST', body: { recordId: recordId.value, mode: mode.value } });
    const result = await stream<{ answer: string }>('/api/llm/ask', { prompt: built.prompt, projectId: projectId.value });
    if (result) answer.value = result.answer;
  } catch {
    failure.value = 'Запрос не собран';
  }
}
</script>

<template>
  <div class="space-y-3">
    <h1 class="text-xl font-semibold">Помощник аналитика</h1>
    <div class="flex flex-wrap items-center gap-2">
      <select v-model="recordId" class="rounded border border-default bg-default px-2 py-1 text-sm">
        <option value="" disabled>Требование</option>
        <option v-for="item in requirements" :key="item.id" :value="item.id">{{ item.id }} · {{ item.title }}</option>
      </select>
      <select v-model="mode" class="rounded border border-default bg-default px-2 py-1 text-sm">
        <option value="clarify">Уточнить</option>
        <option value="contradictions">Найти противоречия</option>
        <option value="criteria">Предложить критерии</option>
      </select>
      <UButton :disabled="!recordId || running" @click="ask">Спросить</UButton>
    </div>
    <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
    <p v-if="failure" class="text-sm text-error">{{ failure }}</p>
    <pre v-if="answer" class="whitespace-pre-wrap rounded border border-default p-3 text-sm">{{ answer }}</pre>
  </div>
</template>
