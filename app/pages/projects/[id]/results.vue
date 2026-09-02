<script setup lang="ts">
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure } = useProjectIndex(projectId);

// Индекс уже отдаёт прогоны новыми сверху (server/lib/indexer.ts).
const reports = computed(() => index.value?.reports ?? []);

function failedCount(report: (typeof reports.value)[number]): number {
  return report.failed ?? Object.values(report.verifications).filter((state) => state === 'failed').length;
}

function totalCount(report: (typeof reports.value)[number]): number {
  return report.total ?? Object.keys(report.verifications).length;
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Результат</h1>
        <p class="text-sm text-muted">{{ reports.length }}</p>
      </div>

      <div v-if="reports.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Отчётов о прогонах нет. Приложение их не пишет — прогнать проверки и
        положить отчёт в <code>docs/development/tests/reports/</code> нужно
        руками или своим инструментом.
      </div>

      <ul v-else class="divide-y divide-default rounded-lg border border-default">
        <li v-for="(report, i) in reports" :key="`${report.started_at}-${i}`" class="p-4">
          <details>
            <summary class="flex flex-wrap items-center gap-3 cursor-pointer">
              <span class="font-medium">{{ report.started_at.replace('T', ' ').slice(0, 16) }}</span>
              <UBadge color="neutral" variant="subtle" size="sm">{{ report.runner }}</UBadge>
              <UBadge
                :color="failedCount(report) > 0 ? 'error' : 'success'"
                variant="subtle"
                size="sm"
              >{{ totalCount(report) - failedCount(report) }} из {{ totalCount(report) }}</UBadge>
            </summary>

            <ul class="mt-3 space-y-1 pl-1">
              <li
                v-for="[id, state] in Object.entries(report.verifications)"
                :key="id"
                class="flex items-center gap-2 text-sm"
              >
                <NuxtLink :to="`/projects/${projectId}/records/${id}`" class="font-mono hover:underline">{{ id }}</NuxtLink>
                <UBadge :color="statusColor(state)" variant="subtle" size="sm">{{ RESULT_LABELS[state] }}</UBadge>
              </li>
            </ul>
          </details>
        </li>
      </ul>
    </template>
  </div>
</template>
