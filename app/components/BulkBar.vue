<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * Панель массовых действий над отмеченными записями (docs/04-ui.md,
 * «Массовые действия»). Целевой статус каждой записи выбирает сервер; панель
 * называет число до нажатия и показывает отчёт после.
 */
const props = defineProps<{
  projectId: string;
  selected: IndexRecord[];
  total: number;
  roles: { id: string; name: string }[];
  /** Задачам «Подтвердить» не предлагается: их подтверждение — закрытие фактом. */
  kind: 'document' | 'task';
}>();

const emit = defineEmits<{ done: [] }>();

interface BulkResult {
  id: string;
  ok: boolean;
  from: string;
  to: string;
  code?: string;
  message?: string;
}

interface BulkReport {
  moved: number;
  skipped: number;
  results: BulkResult[];
}

const actor = ref(props.roles[0]?.id ?? '');
const busy = ref('');
const failure = ref<ApiFailure | null>(null);
const report = ref<BulkReport | null>(null);

const empty = computed(() => props.selected.length === 0);
const skipped = computed(() => report.value?.results.filter((result) => !result.ok) ?? []);

const ACTIONS = computed(() => [
  { direction: 'forward', label: 'Вперёд', icon: 'i-lucide-arrow-right', title: 'Каждую отмеченную запись — на один шаг вперёд' },
  { direction: 'back', label: 'Назад', icon: 'i-lucide-arrow-left', title: 'Каждую отмеченную запись — на один шаг назад' },
  ...(props.kind === 'document'
    ? [{ direction: 'approve', label: 'Подтвердить', icon: 'i-lucide-check-check', title: 'Каждую — до «подтверждён», из черновика через «на подтверждение»' }]
    : [])
]);

async function run(direction: string) {
  busy.value = direction;
  failure.value = null;
  report.value = null;
  try {
    const response = await $fetch<BulkReport | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/records/bulk/status`,
      {
        method: 'POST',
        body: { ids: props.selected.map((record) => record.id), direction, actor: actor.value },
        // Отказ приходит телом ответа: причину показываем как есть.
        ignoreResponseError: true
      }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    report.value = response as BulkReport;
    // Отметки снимаются: повторное нажатие двинуло бы переведённые ещё на шаг.
    emit('done');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated/40 px-3 py-2">
      <p class="text-sm">
        Выбрано: <span class="font-medium">{{ props.selected.length }}</span> из {{ props.total }}
      </p>

      <UButton
        v-for="action in ACTIONS"
        :key="action.direction"
        size="sm"
        variant="soft"
        :icon="action.icon"
        :title="action.title"
        :disabled="empty || busy !== ''"
        :loading="busy === action.direction"
        @click="run(action.direction)"
      >
        {{ action.label }}
      </UButton>

      <!-- Неактивная кнопка обязана назвать причину (docs/04-ui.md). -->
      <p v-if="empty" class="min-w-0 flex-1 text-sm text-muted">Отметьте записи флажками.</p>

      <USelect
        v-if="props.roles.length"
        v-model="actor"
        size="sm"
        class="ml-auto w-48"
        :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
      />
    </div>

    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />

    <UAlert
      v-else-if="report"
      :color="report.skipped ? 'warning' : 'success'"
      variant="subtle"
      :icon="report.skipped ? 'i-lucide-triangle-alert' : 'i-lucide-check'"
      :title="`Переведено ${report.moved} из ${report.results.length}`"
      close
      @update:open="report = null"
    >
      <template v-if="skipped.length" #description>
        <p class="mb-1">Пропущено {{ skipped.length }}:</p>
        <ul class="space-y-1">
          <li v-for="result in skipped" :key="result.id">
            <NuxtLink :to="`/projects/${props.projectId}/records/${result.id}`" class="font-mono hover:underline">{{ result.id }}</NuxtLink>
            — {{ result.message }}
          </li>
        </ul>
      </template>
    </UAlert>
  </div>
</template>
