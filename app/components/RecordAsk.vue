<script setup lang="ts">
const { t } = useT();

/**
 * Кнопка «Спросить» в карточке записи (T-0030): вопрос идёт с пакетом контекста
 * этой записи, ответ ложится черновиком заметки, а не правкой записи.
 */
const props = defineProps<{ projectId: string; recordId: string }>();

const open = ref(false);
const question = ref('');
const role = ref('');
const note = ref('');
const answer = ref('');
const skipped = ref<string[]>([]);

function accept(result: { answer: string; note: string }) {
  answer.value = result.answer;
  note.value = result.note;
}

// Через общее хранилище заданий (ADR-0034): ответ переживает переход и обновление страницы.
const { running: busy, elapsed, outcome, stream, cancel } = useModelRequest(() => `${props.projectId}:${props.recordId}:ask`, {
  label: t('t83.record-ask.1'),
  onRecovered: (result) => { open.value = true; accept(result as { answer: string; note: string }); }
});

async function send() {
  note.value = '';
  const result = await stream<{ answer: string; note: string }>(
    `/api/projects/${props.projectId}/records/${props.recordId}/ask`,
    { question: question.value, role: role.value || undefined, exclude: skipped.value }
  );
  if (result) accept(result);
}
</script>

<template>
  <section>
    <button type="button" @click="open = !open">{{ t('t83.record-ask.1') }}</button>
    <div v-if="open">
      <ContextPreview :project-id="projectId" :center-id="recordId" need="ask" @exclude="skipped = $event" />
      <select v-model="role" :aria-label="t('t83.record-ask.2')">
        <option value="">{{ t('t83.record-ask.3') }}</option>
        <option value="manager">{{ t('t83.record-ask.4') }}</option>
        <option value="analyst">{{ t('t83.record-ask.5') }}</option>
        <option value="domain">{{ t('t83.record-ask.6') }}</option>
        <option value="observer">{{ t('t83.record-ask.7') }}</option>
      </select>
      <textarea v-model="question" rows="3" :placeholder="t('t83.record-ask.8')" />
      <button type="button" :disabled="busy || !question.trim()" @click="send">{{ busy ? t('t83.m3.ra.busy') : t('t83.m3.ra.send') }}</button>
      <ModelProgress :running="busy" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
      <template v-if="note">
        <p>{{ t('t83.record-ask.9') }} <span class="font-mono">{{ note }}</span></p>
        <pre>{{ answer }}</pre>
      </template>
    </div>
  </section>
</template>
