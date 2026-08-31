<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ProjectEntry } from '~~/server/lib/types';

const { data, refresh } = useProjects();
const projects = computed<ProjectEntry[]>(() => (Array.isArray(data.value) ? data.value : []));

const root = ref('');
const adding = ref(false);
const failure = ref<ApiFailure | null>(null);

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
      return;
    }
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
          ? 'Нужен файл docs/development/project.yaml. Завести формат в пустом проекте приложение пока не умеет — это фаза 5.'
          : failure.detail"
      />
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
