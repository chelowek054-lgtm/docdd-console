<script setup lang="ts">
import type { ProjectGit } from '~~/server/lib/project-git';

const props = defineProps<{ projectId: string }>();
const { locale } = useT();
const labels = computed(() => locale.value === 'en' ? {
  refresh: 'Refresh',
  loading: 'Loading local branches…',
  error: 'Could not read Git branches.',
  noRepository: 'The project root has no Git repository.',
  current: 'Current branch',
  detached: 'Detached HEAD',
  branches: 'Local branches',
  noBranches: 'No local branches yet.',
  noMain: 'Merge status is available when there is a local main branch.',
  main: 'Base branch',
  merged: 'Tip is in main history',
  unmerged: 'Tip is outside main history'
} : {
  refresh: 'Обновить',
  loading: 'Загружаем локальные ветки…',
  error: 'Не удалось прочитать ветки Git.',
  noRepository: 'В корне проекта нет репозитория Git.',
  current: 'Текущая ветка',
  detached: 'Отсоединённый HEAD',
  branches: 'Локальные ветки',
  noBranches: 'Локальных веток пока нет.',
  noMain: 'Статус слияния появится, когда в репозитории будет локальная ветка main.',
  main: 'Базовая ветка',
  merged: 'Вершина в истории main',
  unmerged: 'Вершина вне истории main'
});

const { data, status, refresh } = useLazyFetch<ProjectGit>(
  () => `/api/projects/${encodeURIComponent(props.projectId)}/git-branches`,
  { server: false }
);
</script>

<template>
  <section class="min-w-0 space-y-3" :aria-busy="status === 'pending'">
    <div class="flex items-center justify-between gap-2">
      <h2 class="text-sm font-semibold">{{ labels.branches }}</h2>
      <UButton
        size="xs"
        color="neutral"
        variant="ghost"
        icon="i-lucide-refresh-cw"
        :title="labels.refresh"
        :aria-label="labels.refresh"
        :loading="status === 'pending'"
        @click="refresh()"
      />
    </div>
    <p v-if="status === 'error'" role="alert" class="text-sm text-error">{{ labels.error }}</p>
    <p v-else-if="!data" role="status" class="text-sm text-muted">{{ labels.loading }}</p>
    <p v-else-if="!data.repository" class="text-sm text-muted">{{ labels.noRepository }}</p>
    <template v-else>
      <dl>
        <dt class="text-xs text-muted">{{ labels.current }}</dt>
        <dd class="break-all font-mono text-sm">{{ data.current ?? labels.detached }}</dd>
      </dl>
      <p v-if="!data.main" class="text-xs text-muted">{{ labels.noMain }}</p>
      <p v-if="!data.branches.length" class="text-sm text-muted">{{ labels.noBranches }}</p>
      <ul v-else class="divide-y divide-default">
        <li v-for="branch in data.branches" :key="branch.name" class="min-w-0 space-y-1 py-2">
          <div class="break-all font-mono text-sm" :class="{ 'font-semibold': branch.name === data.current }">{{ branch.name }}</div>
          <div v-if="branch.taskId || branch.merged !== null" class="flex flex-wrap items-center gap-1">
            <UBadge v-if="branch.taskId" color="neutral" variant="subtle" size="xs">{{ branch.taskId }}</UBadge>
            <UBadge v-if="branch.name === 'main'" color="neutral" variant="soft" size="xs">{{ labels.main }}</UBadge>
            <UBadge v-else-if="branch.merged === true" color="success" variant="soft" size="xs">{{ labels.merged }}</UBadge>
            <UBadge v-else-if="branch.merged === false" color="warning" variant="soft" size="xs">{{ labels.unmerged }}</UBadge>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
