<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * Предложенное моделью разбиение (docs/04-ui.md, «Разбить на фазы»): список,
 * который человек правит — выключает лишнее, переименовывает, — и только
 * потом «Создать фазы». Файлы задач не меняются.
 */
const props = defineProps<{
  projectId: string;
  answer: string;
  /** Задачи, ушедшие в запрос. */
  tasks: string[];
}>();

const emit = defineEmits<{ changed: [] }>();

interface Row {
  key: string;
  title: string;
  body?: string;
  covers: string[];
  include: boolean;
}

const rows = ref<Row[]>([]);
const uncovered = ref<string[]>([]);
const problems = ref<string[]>([]);
const loading = ref(false);
const creating = ref(false);
const failure = ref<ApiFailure | null>(null);
const created = ref<{ id: string; title: string }[] | null>(null);

const chosen = computed(() => rows.value.filter((row) => row.include && row.title.trim() !== ''));
const allOn = computed<boolean | 'indeterminate'>(() => {
  const on = rows.value.filter((row) => row.include).length;
  if (on === 0) return false;
  return on === rows.value.length ? true : 'indeterminate';
});

function toggleAll() {
  const next = allOn.value !== true;
  for (const row of rows.value) row.include = next;
}

async function load() {
  loading.value = true;
  failure.value = null;
  created.value = null;
  try {
    const response = await $fetch<
      { phases: Omit<Row, 'include'>[]; uncovered: string[]; problems: string[] } | { error: ApiFailure }
    >(`/api/projects/${props.projectId}/phases/preview`, {
      method: 'POST',
      body: { answer: props.answer, tasks: props.tasks },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      rows.value = [];
      return;
    }
    const plan = response as { phases: Omit<Row, 'include'>[]; uncovered: string[]; problems: string[] };
    rows.value = plan.phases.map((phase) => ({ ...phase, include: true }));
    uncovered.value = plan.uncovered;
    problems.value = plan.problems;
  } finally {
    loading.value = false;
  }
}

async function create() {
  creating.value = true;
  failure.value = null;
  try {
    const response = await $fetch<
      { created: { id: string; title: string }[]; problems: string[] } | { error: ApiFailure }
    >(`/api/projects/${props.projectId}/phases`, {
      method: 'POST',
      body: {
        phases: chosen.value.map((row) => ({
          key: row.key,
          title: row.title.trim(),
          body: row.body,
          covers: row.covers
        }))
      },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const done = response as { created: { id: string; title: string }[]; problems: string[] };
    created.value = done.created;
    problems.value = done.problems;
    rows.value = [];
    emit('changed');
  } finally {
    creating.value = false;
  }
}

watch(() => props.answer, load, { immediate: true });
</script>

<template>
  <div class="space-y-3">
    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />

    <UAlert
      v-if="created"
      color="success"
      variant="subtle"
      icon="i-lucide-check"
      :title="`Заведено фаз: ${created.length}`"
    >
      <template #description>
        <p class="mb-1">Фазы в статусе <code>planned</code>; задачи не менялись, состав задаёт <code>covers</code> у фазы.</p>
        <ul>
          <li v-for="item in created" :key="item.id">
            <NuxtLink :to="`/projects/${props.projectId}/records/${item.id}`" class="font-mono hover:underline">{{ item.id }}</NuxtLink>
            {{ item.title }}
          </li>
        </ul>
      </template>
    </UAlert>

    <p v-if="loading" class="text-sm text-muted">Разбираю ответ…</p>

    <template v-else-if="rows.length">
      <div class="flex flex-wrap items-center gap-3">
        <UCheckbox :model-value="allOn" label="Выбрать всё" @update:model-value="toggleAll" />
        <UButton size="sm" :loading="creating" :disabled="chosen.length === 0" @click="create">
          Создать фазы: {{ chosen.length }}
        </UButton>
        <p v-if="chosen.length === 0" class="text-sm text-muted">Все фазы выключены — заводить нечего.</p>
      </div>

      <ul class="space-y-2">
        <li
          v-for="row in rows"
          :key="row.key"
          class="flex gap-3 rounded-lg border border-default p-3"
          :class="row.include ? '' : 'opacity-50'"
        >
          <UCheckbox v-model="row.include" class="pt-1" :aria-label="`Завести фазу ${row.title}`" />
          <div class="min-w-0 flex-1 space-y-2">
            <UInput v-model="row.title" size="sm" class="w-full" :disabled="!row.include" />
            <p v-if="row.body" class="text-sm text-muted">{{ row.body }}</p>
            <p class="text-sm">
              <span class="text-muted">Состав ({{ row.covers.length }}):</span>
              <NuxtLink
                v-for="id in row.covers"
                :key="id"
                :to="`/projects/${props.projectId}/records/${id}`"
                class="ml-2 font-mono text-xs hover:underline"
              >{{ id }}</NuxtLink>
            </p>
          </div>
        </li>
      </ul>
    </template>

    <p v-else-if="!created && !failure && !loading" class="text-sm text-muted">
      Модель не предложила ни одной фазы — так тоже бывает; пояснение — в ответе выше.
    </p>

    <!-- Потеря называется, а не замалчивается (docs/04-ui.md). -->
    <UAlert
      v-if="uncovered.length && !created"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Не попали ни в одну фазу"
    >
      <template #description>
        <NuxtLink
          v-for="id in uncovered"
          :key="id"
          :to="`/projects/${props.projectId}/records/${id}`"
          class="mr-2 font-mono text-xs hover:underline"
        >{{ id }}</NuxtLink>
      </template>
    </UAlert>

    <div v-if="problems.length">
      <p class="text-sm text-muted">Замечания к ответу:</p>
      <ul class="list-disc pl-5 text-sm text-muted">
        <li v-for="(item, at) in problems" :key="at">{{ item }}</li>
      </ul>
    </div>
  </div>
</template>
