<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * Исполнитель задачи (T-0016). Без входа это свободное имя; когда появится
 * команда, список подсказок берётся из неё. Смена пишет строку в журнал.
 */
const props = defineProps<{ projectId: string; task: IndexRecord; people?: string[] }>();
const emit = defineEmits<{ changed: [] }>();

const current = computed(() => (typeof props.task.extra['assignee'] === 'string' ? props.task.extra['assignee'] : ''));
const draft = ref(current.value);
watch(current, (value) => { draft.value = value; });
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);

async function save() {
  busy.value = true;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/records/${props.task.id}`, {
      method: 'PATCH',
      body: { assignee: draft.value.trim() || null, version: props.task.version },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) failure.value = problem;
    else emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-medium">Исполнитель</h2>
    </template>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <UInput v-model="draft" list="assignee-people" placeholder="Кто делает задачу" class="w-64" @keyup.enter="save" />
      <datalist id="assignee-people"><option v-for="person in people ?? []" :key="person" :value="person" /></datalist>
      <UButton :loading="busy" :disabled="draft.trim() === current" @click="save">Назначить</UButton>
      <p v-if="failure" class="text-error">{{ failure.message }}</p>
    </div>
  </UCard>
</template>
