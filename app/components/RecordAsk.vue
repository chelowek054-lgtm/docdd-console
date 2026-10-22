<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
const { t } = useT();

/**
 * Кнопка «Спросить» в карточке записи (T-0030): вопрос идёт с пакетом контекста
 * этой записи, ответ ложится черновиком заметки, а не правкой записи.
 */
const props = defineProps<{ projectId: string; recordId: string }>();

const open = ref(false);
const question = ref('');
const role = ref('');
const busy = ref(false);
const note = ref('');
const answer = ref('');
const failure = ref<ApiFailure | null>(null);
const skipped = ref<string[]>([]);

async function send() {
  busy.value = true;
  failure.value = null;
  note.value = '';
  try {
    const response = await $fetch<{ answer: string; note: string } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/records/${props.recordId}/ask`,
      { method: 'POST', body: { question: question.value, role: role.value || undefined, exclude: skipped.value }, ignoreResponseError: true }
    );
    if ('error' in response) { failure.value = response.error; return; }
    answer.value = response.answer;
    note.value = response.note;
  } catch (error) {
    failure.value = { code: 'network', message: t('t83.m3.ra.fail'), detail: String(error) };
  } finally {
    busy.value = false;
  }
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
      <p v-if="failure" role="alert">{{ failure.message }}</p>
      <template v-if="note">
        <p>{{ t('t83.record-ask.9') }} <span class="font-mono">{{ note }}</span></p>
        <pre>{{ answer }}</pre>
      </template>
    </div>
  </section>
</template>
