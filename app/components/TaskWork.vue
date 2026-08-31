<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { WorkState } from '~~/server/utils/work-service';

/**
 * Выполнение задачи через клиент (docs/09-execution.md). Приложение показывает
 * дифф и ничего не сливает само: принимает человек.
 */
const props = defineProps<{
  projectId: string;
  recordId: string;
  status: string;
  roles: { id: string; name: string }[];
}>();

const emit = defineEmits<{ changed: [] }>();

const { data, refresh } = useFetch<WorkState | { error: ApiFailure }>(
  () => `/api/projects/${props.projectId}/records/${props.recordId}/work`,
  { key: () => `work:${props.projectId}:${props.recordId}` }
);

const state = computed(() => (failureOf(data.value) ? null : (data.value as WorkState | null)));

const actor = ref(props.roles[0]?.id ?? '');
const comment = ref('');
const busy = ref('');
const answer = ref('');
const failure = ref<ApiFailure | null>(null);

/** Ворота те же, что у перехода в работу: неподтверждённое не отдаётся. */
const canHandOver = computed(() => props.status === 'ready' || props.status === 'in_progress');

const { data: llm } = useFetch<{ available: boolean; reason: string | null }>('/api/llm', { key: 'llm' });

async function act(action: 'handover' | 'rework' | 'accept' | 'reject') {
  busy.value = action;
  failure.value = null;
  if (action !== 'rework') answer.value = '';
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/records/${props.recordId}/work`, {
      method: 'POST',
      body: { action, actor: actor.value, comment: comment.value },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const result = response as { answer?: string };
    if (result.answer) answer.value = result.answer;
    if (action === 'rework') comment.value = '';
    await refresh();
    emit('changed');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">Работа</h2>
        <p v-if="state?.started" class="text-sm text-muted">
          ветка <span class="font-mono text-xs">{{ state.branch }}</span>
          <template v-if="state.round > 0"> · {{ plural(state.round, 'заход', 'захода', 'заходов') }}</template>
        </p>
        <USelect
          v-if="props.roles.length"
          v-model="actor"
          size="sm"
          class="ml-auto w-44"
          :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
        />
      </div>
    </template>

    <div class="flex flex-wrap items-center gap-3">
      <UButton
        :disabled="!canHandOver || !llm?.available"
        :loading="busy === 'handover'"
        icon="i-lucide-play"
        @click="act('handover')"
      >
        {{ state?.started ? 'Отдать снова' : 'Отдать модели' }}
      </UButton>

      <!-- Недоступное действие обязано назвать причину (docs/04-ui.md). -->
      <p v-if="!canHandOver" class="min-w-0 flex-1 text-sm text-muted">
        Задача в статусе <code>{{ props.status }}</code>. Отдавать модели можно только
        готовую к работе: подтверждение человеком идёт раньше кода.
      </p>
      <p v-else-if="!llm?.available" class="min-w-0 flex-1 text-sm text-muted">
        {{ llm?.reason }}
      </p>
    </div>

    <UAlert
      v-if="failure"
      class="mt-3"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />

    <template v-if="state?.started && state.files.length">
      <div class="mt-4">
        <div class="flex flex-wrap items-center gap-3">
          <h3 class="font-medium">Изменено файлов: {{ state.files.length }}</h3>
          <UBadge v-if="state.forbidden.length" color="error" variant="subtle">
            тронуты записи процесса — слияние отклонят
          </UBadge>
        </div>
        <ul class="mt-2 space-y-1 text-xs">
          <li
            v-for="file in state.files"
            :key="file"
            class="font-mono"
            :class="state.forbidden.includes(file) ? 'text-error' : 'text-muted'"
          >{{ file }}</li>
        </ul>
      </div>

      <pre class="mt-3 max-h-96 overflow-auto rounded bg-elevated p-3 text-xs">{{ state.diff }}</pre>

      <div class="mt-4 space-y-3">
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            color="primary"
            :loading="busy === 'accept'"
            :disabled="state.forbidden.length > 0"
            @click="act('accept')"
          >
            Принять и слить
          </UButton>
          <UButton
            variant="outline"
            color="neutral"
            :loading="busy === 'rework'"
            :disabled="!comment.trim()"
            @click="act('rework')"
          >
            На доработку
          </UButton>
          <UButton variant="ghost" color="neutral" :loading="busy === 'reject'" @click="act('reject')">
            Отклонить
          </UButton>
        </div>

        <UTextarea
          v-model="comment"
          :rows="2"
          placeholder="Что не так — уйдёт в запрос на доработку"
          class="w-full"
        />
      </div>
    </template>

    <p v-else-if="state?.started" class="mt-3 text-sm text-muted">
      Ветка заведена, изменений пока нет.
    </p>

    <div v-if="answer" class="mt-4">
      <h3 class="mb-2 font-medium">Что сказала модель</h3>
      <div class="max-h-72 overflow-y-auto">
        <DocumentText :body="answer" />
      </div>
    </div>
  </UCard>
</template>
