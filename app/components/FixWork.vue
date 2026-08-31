<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { FixState } from '~~/server/utils/fix-service';

/**
 * Починка нарушений по подтверждённому плану
 * (docs/adr/0010-model-fixes-violations.md). «Принять ответ» — это и есть
 * подтверждение: до него не заводится ни ветка, ни правка. Дальше приложение
 * показывает дифф и ничего не сливает само.
 */
const props = defineProps<{
  projectId: string;
  /** План, который человек читает: ответ модели на «Исправить». */
  plan: string;
  codes: string[];
  severity: string;
  roles: { id: string; name: string }[];
}>();

const emit = defineEmits<{ changed: [] }>();

const { running, elapsed, outcome, log, stream, cancel } = useModelRequest();

const actor = ref(props.roles[0]?.id ?? '');
const state = ref<FixState | null>(null);
const failure = ref<ApiFailure | null>(null);
const busy = ref('');

const filter = computed(() => ({ codes: props.codes, severity: props.severity }));

/** Отказ приложения — не поломка: он говорит, что предохранитель сработал. */
const refused = computed(() => {
  if (!state.value) return '';
  if (state.value.foreign.length) {
    return `Тронуто сверх плана: ${state.value.foreign.join(', ')}. Такую починку приложение не сливает`;
  }
  if (state.value.approvals.length) {
    return `Модель подтвердила записи сама: ${state.value.approvals.join(', ')}. Подтверждение — ваше действие`;
  }
  return '';
});

async function apply() {
  failure.value = null;
  const result = await stream<{ state: FixState }>(`/api/projects/${props.projectId}/fix`, {
    plan: props.plan,
    ...filter.value
  });
  if (!result) return;

  state.value = result.state;
}

async function decide(action: 'accept' | 'reject') {
  busy.value = action;
  failure.value = null;
  try {
    const response = await $fetch<{ state: FixState } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/fix/work`,
      { method: 'POST', body: { action, actor: actor.value, ...filter.value }, ignoreResponseError: true }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    state.value = (response as { state: FixState }).state;
    emit('changed');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="mt-4 space-y-3 border-t border-default pt-4">
    <div class="flex flex-wrap items-center gap-3">
      <UButton v-if="!running" icon="i-lucide-check" @click="apply">
        {{ state?.started ? 'Починить заново' : 'Принять ответ' }}
      </UButton>

      <p v-if="!running && !state?.started" class="min-w-0 flex-1 text-sm text-muted">
        План выполнит модель — в отдельной ветке. Слить или отклонить решите вы, по диффу.
      </p>

      <USelect
        v-if="props.roles.length"
        v-model="actor"
        size="sm"
        class="ml-auto w-44"
        :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
      />
    </div>

    <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
    <ModelLog :lines="log" :running="running" />

    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />

    <template v-if="state?.started && state.files.length">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="font-medium">Изменено файлов: {{ state.files.length }}</h3>
        <!-- Предохранитель сработал — это не поломка, а работа (docs/04-ui.md). -->
        <UBadge v-if="refused" color="error" variant="subtle">починка не сливается</UBadge>
      </div>

      <ul class="space-y-1 text-xs">
        <li
          v-for="file in state.files"
          :key="file"
          class="font-mono"
          :class="state.foreign.includes(file) || state.approvals.includes(file) ? 'text-error' : 'text-muted'"
        >{{ file }}</li>
      </ul>

      <p v-if="refused" class="text-sm text-error">{{ refused }}</p>

      <pre class="max-h-96 overflow-auto rounded bg-elevated p-3 text-xs">{{ state.diff }}</pre>

      <div class="flex flex-wrap items-center gap-3">
        <UButton color="primary" :loading="busy === 'accept'" :disabled="!!refused" @click="decide('accept')">
          Принять и слить
        </UButton>
        <UButton variant="ghost" color="neutral" :loading="busy === 'reject'" @click="decide('reject')">
          Отклонить
        </UButton>
        <p class="min-w-0 flex-1 text-sm text-muted">
          В журнал каждой починенной записи уйдёт строка: какое нарушение чинили.
        </p>
      </div>
    </template>

    <p v-else-if="state?.started" class="text-sm text-muted">
      Ветка починки заведена, изменений в ней нет.
    </p>
  </div>
</template>
