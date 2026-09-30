<script setup lang="ts">
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, refresh } = useProjectIndex(projectId);

const listed = computed(() => records.value.filter((record) => record.type === 'verification'));
const statuses = computed(() => listed.value.map((record) => record.status));
const status = useStatusFilter(statuses);
const checks = computed(() => (status.value ? listed.value.filter((record) => record.status === status.value) : listed.value));
const results = computed(() => index.value?.verificationResults ?? {});
const selection = useSelection(checks);

/** Что проверяет: связь ставится в обе стороны, показываем как одно множество. */
function verifiesOf(check: (typeof checks.value)[number]): string[] {
  return [...new Set([...(check.links.verifies ?? []), ...(check.backlinks.verified_by ?? [])])];
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Проверки</h1>
        <p class="text-sm text-muted">{{ checks.length }}<template v-if="status"> из {{ listed.length }}</template></p>
        <NewRecord class="ml-auto" :project-id="projectId" type="verification" :records="records" @created="refresh" />
      </div>

      <StatusTabs v-model="status" :statuses="statuses" :order="DOCUMENT_STATUS_ORDER" />

      <BulkBar
        :project-id="projectId"
        :selected="selection.selected.value"
        :total="checks.length"
        :roles="index?.project.roles ?? []"
        kind="document"
        @done="selection.clear(); refresh()"
      />

      <div v-if="listed.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Проверок в проекте нет. Заводятся они в файлах — приложение записей не создаёт.
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
              <th class="p-3 font-medium">Проверка</th>
              <th class="p-3 font-medium">Решение</th>
              <th class="p-3 font-medium">Что проверяет</th>
              <th class="p-3 font-medium">Факт: последний прогон</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="check in checks" :key="check.path">
              <td class="p-3">
                <UCheckbox
                  :model-value="selection.has(check.id)"
                  :aria-label="`Отметить ${check.id}`"
                  @update:model-value="selection.set(check.id, $event)"
                />
              </td>
              <td class="p-3">
                <RecordLink :project-id="projectId" :record-id="check.id" :record="check" />
              </td>
              <td class="p-3">
                <StatusBadge :status="check.status" />
              </td>
              <td class="p-3">
                <template v-if="verifiesOf(check).length">
                  <NuxtLink
                    v-for="id in verifiesOf(check)"
                    :key="id"
                    :to="`/projects/${projectId}/records/${id}`"
                    class="mr-2 font-mono text-xs hover:underline"
                  >{{ id }}</NuxtLink>
                </template>
                <span v-else class="text-muted">ничего</span>
              </td>
              <td class="p-3">
                <UBadge
                  v-if="results[check.id]"
                  :color="statusColor(results[check.id]!.state)"
                  variant="subtle"
                  size="sm"
                >{{ RESULT_LABELS[results[check.id]!.state] }} · {{ results[check.id]!.at.slice(0, 10) }}</UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="sm">не запускалась</UBadge>
                <!-- Результат засчитывается как есть, но под ним — неподтверждённый способ. -->
                <UBadge
                  v-if="checkNote(check.status, !!results[check.id])"
                  color="warning"
                  variant="subtle"
                  size="sm"
                  class="ml-1"
                >{{ checkNote(check.status, !!results[check.id]) }}</UBadge>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
