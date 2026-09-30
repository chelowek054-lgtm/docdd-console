<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, refresh } = useProjectIndex(projectId);

const listed = computed(() => records.value.filter((record) => record.type === 'requirement'));
const statuses = computed(() => listed.value.map((record) => record.status));
const status = useStatusFilter(statuses);
const requirements = computed(() => (status.value ? listed.value.filter((record) => record.status === status.value) : listed.value));
const results = computed(() => index.value?.verificationResults ?? {});
const selection = useSelection(requirements);

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

/** Факт — результат прогонов; «подтверждён» в колонке решения — другое (docs/04-ui.md). */
function outcome(requirement: IndexRecord) {
  return requirementFact(verificationsOf(requirement), results.value, requirement.status);
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Требования</h1>
        <p class="text-sm text-muted">{{ requirements.length }}<template v-if="status"> из {{ listed.length }}</template></p>
        <NewRecord class="ml-auto" :project-id="projectId" type="requirement" :records="records" @created="refresh" />
      </div>

      <StatusTabs v-model="status" :statuses="statuses" :order="DOCUMENT_STATUS_ORDER" />

      <BulkBar
        :project-id="projectId"
        :selected="selection.selected.value"
        :total="requirements.length"
        :roles="index?.project.roles ?? []"
        kind="document"
        @done="selection.clear(); refresh()"
      />

      <div v-if="listed.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Требований в проекте нет. Заводятся они в файлах — приложение записей не создаёт.
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="w-10 p-3">
                <UCheckbox
                  :model-value="selection.state.value"
                  aria-label="Выбрать всё"
                  @update:model-value="selection.toggleAll()"
                />
              </th>
              <th class="p-3 font-medium">Требование</th>
              <th class="p-3 font-medium">Решение</th>
              <th class="p-3 font-medium">Задачи</th>
              <th class="p-3 font-medium">Проверки</th>
              <th class="p-3 font-medium">Факт</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="requirement in requirements" :key="requirement.path">
              <td class="p-3">
                <UCheckbox
                  :model-value="selection.has(requirement.id)"
                  :aria-label="`Отметить ${requirement.id}`"
                  @update:model-value="selection.set(requirement.id, $event)"
                />
              </td>
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
