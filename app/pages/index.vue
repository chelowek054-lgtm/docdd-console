<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ProjectEntry } from '~~/server/lib/types';

const { data, refresh } = useProjects();
const projects = computed<ProjectEntry[]>(() => (Array.isArray(data.value) ? data.value : []));

const root = ref('');
const adding = ref(false);
const failure = ref<ApiFailure | null>(null);

/** Формат заводится только там, где его нет: предложение появляется после отказа. */
const offerInit = ref(false);
const newId = ref('');
const newName = ref('');
const initFailure = ref<ApiFailure | null>(null);
const initializing = ref(false);

function suggestFromPath(path: string) {
  // Путь приходит и с прямыми, и с обратными слешами: пользователь копирует его
  // из проводника как есть.
  const name = path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? '';
  newName.value = name;
  newId.value = name.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'project';
}

async function init() {
  initializing.value = true;
  initFailure.value = null;
  try {
    const response = await $fetch<ProjectEntry | { error: ApiFailure }>('/api/projects/init', {
      method: 'POST',
      body: { root: root.value.trim(), id: newId.value.trim(), name: newName.value.trim() },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      initFailure.value = problem;
      return;
    }
    offerInit.value = false;
    failure.value = null;
    root.value = '';
    await refresh();
  } finally {
    initializing.value = false;
  }
}

async function add() {
  if (!root.value.trim()) return;
  adding.value = true;
  failure.value = null;
  try {
    const response = await $fetch<ProjectEntry | { error: ApiFailure }>('/api/projects', {
      method: 'POST',
      body: { root: root.value.trim() },
      // Ошибку показываем текстом ответа, а не «что-то пошло не так»: сообщения
      // сервера написаны по-русски и для человека (docs/04-ui.md).
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      // Манифеста нет — предлагаем завести формат, а не просто отказываем.
      offerInit.value = problem.code === 'project_not_found';
      if (offerInit.value) suggestFromPath(root.value.trim());
      return;
    }
    offerInit.value = false;
    root.value = '';
    await refresh();
  } finally {
    adding.value = false;
  }
}

async function remove(id: string) {
  await $fetch(`/api/projects/${id}`, { method: 'DELETE', ignoreResponseError: true });
  await refresh();
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold">Проекты</h1>
      <p class="text-sm text-muted">Инструмент читает <code>docs/development</code> выбранного проекта и ничего в нём не переписывает.</p>
    </div>

    <UCard>
      <div class="flex flex-col gap-3 sm:flex-row">
        <UInput
          v-model="root"
          placeholder="D:\work\fishForecast"
          icon="i-lucide-folder"
          class="flex-1"
          @keyup.enter="add"
        />
        <UButton :loading="adding" @click="add">Добавить проект</UButton>
      </div>

      <UAlert
        v-if="failure"
        class="mt-4"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="failure.message"
        :description="failure.code === 'project_not_found'
          ? 'В папке нет docs/development/project.yaml. Формат можно завести прямо сейчас — ниже.'
          : failure.detail"
      />

      <div v-if="offerInit" class="mt-4 space-y-3 rounded-lg border border-default p-4">
        <p class="text-sm">Завести формат в <span class="font-mono">{{ root }}</span>?</p>
        <div class="flex flex-col gap-3 sm:flex-row">
          <UInput v-model="newName" placeholder="Имя проекта" class="flex-1" />
          <UInput v-model="newId" placeholder="идентификатор-латиницей" class="flex-1" />
          <UButton :loading="initializing" :disabled="!newId.trim() || !newName.trim()" @click="init">
            Завести формат
          </UButton>
        </div>
        <p class="text-xs text-muted">
          Будут созданы <code>docs/development/project.yaml</code>, папки разделов и
          первая запись — требование-заготовка. Существующие файлы не тронутся.
        </p>
        <UAlert
          v-if="initFailure"
          color="error"
          variant="subtle"
          :title="initFailure.message"
          :description="initFailure.detail"
        />
      </div>
    </UCard>

    <div v-if="projects.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center">
      <p class="font-medium">Проектов пока нет</p>
      <p class="mt-1 text-sm text-muted">
        Укажите путь к папке проекта — той, внутри которой лежит
        <code>docs/development/project.yaml</code>.
      </p>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="project in projects" :key="project.id">
        <UCard>
          <div class="flex flex-wrap items-center gap-4">
            <div class="min-w-0 flex-1">
              <NuxtLink :to="`/projects/${project.id}`" class="font-medium hover:underline">
                {{ project.name }}
              </NuxtLink>
              <p class="truncate text-sm text-muted">{{ project.root }}</p>
            </div>
            <p class="text-sm text-muted">Открывали {{ shortDate(project.lastOpenedAt) }}</p>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              :aria-label="`Убрать ${project.name} из списка`"
              @click="remove(project.id)"
            />
          </div>
        </UCard>
      </li>
    </ul>

    <p class="text-sm text-muted">Убрать проект из списка — не то же, что удалить: файлы остаются на месте.</p>
  </div>
</template>
