<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

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
    failure.value = { code: 'network', message: 'Не удалось спросить модель', detail: String(error) };
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section>
    <button type="button" @click="open = !open">Спросить</button>
    <div v-if="open">
      <ContextPreview :project-id="projectId" :center-id="recordId" need="ask" @exclude="skipped = $event" />
      <select v-model="role" aria-label="Роль">
        <option value="">Без роли</option>
        <option value="manager">Менеджер</option>
        <option value="analyst">Аналитик</option>
        <option value="domain">Доменный специалист</option>
        <option value="observer">Наблюдатель</option>
      </select>
      <textarea v-model="question" rows="3" placeholder="Вопрос к модели по этой записи" />
      <button type="button" :disabled="busy || !question.trim()" @click="send">{{ busy ? 'Спрашиваю…' : 'Отправить' }}</button>
      <p v-if="failure" role="alert">{{ failure.message }}</p>
      <template v-if="note">
        <p>Черновик заметки: <span class="font-mono">{{ note }}</span></p>
        <pre>{{ answer }}</pre>
      </template>
    </div>
  </section>
</template>
