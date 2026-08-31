<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, errors, warnings, refresh, status } = useProjectIndex(projectId);

const tasks = computed(() => records.value.filter((record) => record.type === 'task'));
const counts = computed(() => {
  const byStatus = new Map<string, number>();
  for (const task of tasks.value) byStatus.set(task.status, (byStatus.get(task.status) ?? 0) + 1);
  return ['backlog', 'ready', 'in_progress', 'in_review', 'done', 'dropped']
    .map((state) => ({ state, count: byStatus.get(state) ?? 0 }));
});

/** «Можно брать»: задачи в ready, отсортированные по фазе (docs/04-ui.md). */
const ready = computed(() => tasks.value
  .filter((task) => task.status === 'ready')
  .sort((a, b) => (a.phase ?? '').localeCompare(b.phase ?? '') || a.id.localeCompare(b.id)));

const inWork = computed(() => tasks.value
  .filter((task) => task.status === 'in_progress' || task.status === 'in_review')
  .sort((a, b) => (daysSince(b.updated) ?? 0) - (daysSince(a.updated) ?? 0)));

/** Задача считается зависшей, если о ней сказало правило: порог живёт в проекте. */
const staleIds = computed(() => new Set(
  (index.value?.issues ?? [])
    .filter((issue) => issue.code === 'task_stale')
    .map((issue) => issue.recordId)
));

const blocking = computed(() => errors.value.slice(0, 8));

function days(record: IndexRecord): string {
  const count = daysSince(record.updated);
  return count === null ? 'без даты' : plural(count, 'день', 'дня', 'дней');
}
</script>

<template>
  <div class="space-y-6">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-4">
        <div>
          <h1 class="text-xl font-semibold">{{ index?.project.name ?? 'Проект' }}</h1>
          <p class="text-sm text-muted">
            Разбор собран {{ index ? new Date(index.builtAt).toLocaleString('ru-RU') : '—' }}
          </p>
        </div>
        <UButton
          class="ml-auto"
          variant="soft"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :loading="status === 'pending'"
          @click="refresh"
        >
          Перечитать
        </UButton>
      </div>

      <!-- Цифра всегда с причиной: каждая ведёт к списку, а не висит в воздухе. -->
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <NuxtLink :to="`/projects/${projectId}/issues`" class="block">
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-3xl font-semibold" :class="errors.length ? 'text-error' : 'text-success'">
              {{ errors.length }}
            </p>
            <p class="text-sm text-muted">{{ plural(errors.length, 'ошибка', 'ошибки', 'ошибок') }} процесса</p>
          </UCard>
        </NuxtLink>

        <NuxtLink :to="`/projects/${projectId}/issues`" class="block">
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-3xl font-semibold">{{ warnings.length }}</p>
            <p class="text-sm text-muted">{{ plural(warnings.length, 'предупреждение', 'предупреждения', 'предупреждений') }}</p>
          </UCard>
        </NuxtLink>

        <NuxtLink :to="`/projects/${projectId}/tasks`" class="block">
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-3xl font-semibold">{{ ready.length }}</p>
            <p class="text-sm text-muted">можно брать</p>
          </UCard>
        </NuxtLink>

        <NuxtLink :to="`/projects/${projectId}/tasks`" class="block">
          <UCard :ui="{ body: 'p-4' }">
            <p class="text-3xl font-semibold">{{ inWork.length }}</p>
            <p class="text-sm text-muted">в работе</p>
          </UCard>
        </NuxtLink>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <UCard>
          <template #header>
            <h2 class="font-medium">Можно брать</h2>
          </template>
          <p v-if="ready.length === 0" class="text-sm text-muted">
            Готовых задач нет. Задача становится готовой, когда её документы подтверждены и есть связь <code>implements</code>.
          </p>
          <ul v-else class="space-y-2">
            <li v-for="task in ready" :key="task.id" class="flex items-start justify-between gap-2">
              <RecordLink :project-id="projectId" :record-id="task.id" :record="task" />
              <UBadge v-if="task.phase" color="neutral" variant="subtle" size="sm">{{ task.phase }}</UBadge>
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-medium">В работе</h2>
          </template>
          <p v-if="inWork.length === 0" class="text-sm text-muted">Никто ничего не начинал.</p>
          <ul v-else class="space-y-2">
            <li v-for="task in inWork" :key="task.id" class="flex items-start justify-between gap-2">
              <RecordLink :project-id="projectId" :record-id="task.id" :record="task" />
              <UBadge :color="staleIds.has(task.id) ? 'warning' : 'neutral'" variant="subtle" size="sm">
                {{ days(task) }}
              </UBadge>
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header>
            <h2 class="font-medium">Мешает</h2>
          </template>
          <p v-if="blocking.length === 0" class="text-sm text-muted">Ничего не мешает: ошибок процесса нет.</p>
          <ul v-else class="space-y-2">
            <li v-for="(issue, at) in blocking" :key="`${issue.code}:${at}`" class="text-sm">
              <NuxtLink
                v-if="issue.recordId"
                :to="`/projects/${projectId}/records/${issue.recordId}`"
                class="font-mono text-xs hover:underline"
              >{{ issue.recordId }}</NuxtLink>
              <p class="text-muted">{{ issue.message }}</p>
            </li>
          </ul>
        </UCard>
      </div>

      <UCard>
        <template #header>
          <h2 class="font-medium">Задачи по статусам</h2>
        </template>
        <div class="flex flex-wrap gap-4">
          <div v-for="item in counts" :key="item.state" class="min-w-24">
            <p class="text-2xl font-semibold">{{ item.count }}</p>
            <p class="text-sm text-muted">{{ statusLabel(item.state) }}</p>
          </div>
        </div>
      </UCard>
    </template>
  </div>
</template>
