<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records } = useProjectIndex(projectId);

const requirements = computed(() => records.value.filter((record) => record.type === 'requirement'));
const results = computed(() => index.value?.verificationResults ?? {});

/**
 * Таблица покрытия: требование, статус, задачи, проверки, последний результат.
 * Строка без проверки видна сразу — это главный дефект, который экран ищет.
 */
function verificationsOf(requirement: IndexRecord): string[] {
  return [...new Set([
    ...(requirement.links.verified_by ?? []),
    ...(requirement.backlinks.verifies ?? [])
  ])];
}

function tasksOf(requirement: IndexRecord): string[] {
  return requirement.backlinks.implements ?? [];
}

/** Факт сильнее объявления: подтверждено то, что прошло прогон. */
function outcome(requirement: IndexRecord): { label: string; color: BadgeColor } {
  const ids = verificationsOf(requirement);
  if (ids.length === 0) return { label: 'не проверяется', color: 'warning' };

  const states = ids.map((id) => results.value[id]?.state);
  if (states.some((state) => state === 'failed')) return { label: 'не прошла', color: 'error' };
  if (states.every((state) => state === 'passed')) return { label: 'подтверждено прогоном', color: 'success' };
  return { label: 'только объявлено', color: 'neutral' };
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Требования</h1>
        <p class="text-sm text-muted">{{ requirements.length }}</p>
      </div>

      <div v-if="requirements.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Требований в проекте нет. Заводятся они в файлах — приложение записей не создаёт.
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="p-3 font-medium">Требование</th>
              <th class="p-3 font-medium">Статус</th>
              <th class="p-3 font-medium">Задачи</th>
              <th class="p-3 font-medium">Проверки</th>
              <th class="p-3 font-medium">Результат</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="requirement in requirements" :key="requirement.path">
              <td class="p-3">
                <RecordLink :project-id="projectId" :record-id="requirement.id" :record="requirement" />
              </td>
              <td class="p-3">
                <StatusBadge :status="requirement.status" />
              </td>
              <td class="p-3">
                <template v-if="tasksOf(requirement).length">
                  <NuxtLink
                    v-for="id in tasksOf(requirement)"
                    :key="id"
                    :to="`/projects/${projectId}/records/${id}`"
                    class="mr-2 font-mono text-xs hover:underline"
                  >{{ id }}</NuxtLink>
                </template>
                <span v-else class="text-muted">ни одной</span>
              </td>
              <td class="p-3">
                <template v-if="verificationsOf(requirement).length">
                  <NuxtLink
                    v-for="id in verificationsOf(requirement)"
                    :key="id"
                    :to="`/projects/${projectId}/records/${id}`"
                    class="mr-2 font-mono text-xs hover:underline"
                  >{{ id }}</NuxtLink>
                </template>
                <span v-else class="text-muted">нет</span>
              </td>
              <td class="p-3">
                <UBadge :color="outcome(requirement).color" variant="subtle" size="sm">
                  {{ outcome(requirement).label }}
                </UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
