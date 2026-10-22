<script setup lang="ts"> const { me } = useMe(() => "");
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
const initializing = ref(false); const gitReady = ref(false); const template = ref('none'); /* шаблон проекта (R-0090): none — пустой формат */ const templateItems = computed(() => [{ label: t('home.templateNone'), value: 'none' }, { label: t('home.templateCore'), value: 'software-core' }]);

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
      body: { root: root.value.trim(), id: newId.value.trim(), name: newName.value.trim(), ...(template.value !== 'none' ? { template: template.value } : {}) },
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

// Тексты экрана — ключи словаря (docs/16-design-system.md, «i18n»): в разметке ни
// одной строки на конкретном языке, поэтому переключение языка не требует правки
// шаблона. Дата и время пишутся по правилам выбранного языка (`dateTime`), а не
// «ru-RU» по умолчанию.
const { t, dateTime } = useT();

function shortDate(iso: string): string {
  return dateTime(iso);
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-xl font-semibold">{{ t('home.title') }}</h1><NuxtLink v-if="me.user?.admin" to="/people" class="text-sm text-primary hover:underline">Люди</NuxtLink>
      <p class="text-sm text-muted">{{ t('home.lead') }}</p>
    </div>

    <UCard>
      <div class="flex flex-col gap-3 sm:flex-row">
        <UInput
          v-model="root"
          :placeholder="t('home.pathPlaceholder')"
          icon="i-lucide-folder"
          class="flex-1"
          @keyup.enter="add"
        />
        <UButton :loading="adding" @click="add">{{ t('home.add') }}</UButton>
      </div>

      <UAlert
        v-if="failure"
        class="mt-4"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="failure.message"
        :description="failure.code === 'project_not_found'
          ? t('home.noManifest')
          : failure.detail"
      />

      <div v-if="offerInit" class="mt-4 space-y-3 ds-card p-4">
        <p class="text-sm">{{ t('home.initQuestion', { root }) }}</p><GitGate v-model="gitReady" :root="root" />
        <div class="flex flex-col gap-3 sm:flex-row">
          <UInput v-model="newName" :placeholder="t('home.namePlaceholder')" class="flex-1" />
          <UInput v-model="newId" :placeholder="t('home.idPlaceholder')" class="flex-1" />
          <UButton :loading="initializing" :disabled="!newId.trim() || !newName.trim() || !gitReady" @click="init">
            {{ t('home.initButton') }}
          </UButton>
        </div>
        <UFormField :label="t('home.template')" :help="t('home.templateHelp')"><USelect v-model="template" :items="templateItems" class="w-full sm:w-80" /></UFormField>
        <p class="text-xs text-muted">{{ t('home.initNote') }}</p>
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
      <p class="font-medium">{{ t('home.emptyTitle') }}</p>
      <p class="mt-1 text-sm text-muted">{{ t('home.emptyText') }}</p>
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
            <p class="text-sm text-muted">{{ t('home.opened', { when: shortDate(project.lastOpenedAt) }) }}</p>
            <UButton
              variant="ghost"
              color="neutral"
              icon="i-lucide-x"
              :aria-label="t('home.remove', { name: project.name })"
              @click="remove(project.id)"
            />
          </div>
        </UCard>
      </li>
    </ul>

    <p class="text-sm text-muted">{{ t('home.removeNote') }}</p>
  </div>
</template>
