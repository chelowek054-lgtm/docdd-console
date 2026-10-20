<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';
import { assistantPrompt, type AssistantQuestion } from '~~/server/lib/manager';

/**
 * Помощник менеджера (T-0036): три вопроса к модели. Данные подставляются в текст
 * запроса, инструменты модели выключены; ответ — черновик, порядок применяется
 * отдельно кнопкой «Применить порядок» на экране «Работа».
 */
const props = defineProps<{ projectId: string; records: IndexRecord[] }>();

const QUESTIONS: { key: AssistantQuestion; label: string }[] = [
  { key: 'blockers', label: 'Что блокирует' },
  { key: 'changes', label: 'Что изменилось за неделю' },
  { key: 'plan', label: 'План фазы' }
];
const answer = ref('');
const asked = ref<AssistantQuestion | ''>('');
const { running, elapsed, outcome, stream, cancel } = useModelRequest(() => `${props.projectId}:manager`, { label: 'Помощник менеджера' });

async function ask(question: AssistantQuestion) {
  asked.value = question;
  answer.value = '';
  const prompt = assistantPrompt(question, props.records, new Date().toISOString().slice(0, 10));
  const result = await stream<{ answer: string }>('/api/llm/ask', { prompt, projectId: props.projectId, tools: false });
  if (result) answer.value = result.answer;
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <UButton v-for="q in QUESTIONS" :key="q.key" :disabled="running" :variant="asked === q.key ? 'solid' : 'outline'" @click="ask(q.key)">{{ q.label }}</UButton>
      <UButton v-if="running" color="neutral" variant="ghost" @click="cancel()">Отменить ({{ elapsed }} с)</UButton>
    </div>
    <p v-if="outcome && !running && !answer" class="text-sm text-error">{{ typeof outcome === 'string' ? outcome : 'Модель не ответила.' }}</p>
    <div v-if="answer" class="space-y-1">
      <p class="text-xs text-muted">Черновик модели: проверьте, прежде чем применять.</p>
      <pre class="whitespace-pre-wrap rounded border border-default p-3 text-sm">{{ answer }}</pre>
    </div>
  </div>
</template>
