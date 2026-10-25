<script setup lang="ts">
/**
 * «Аналитика» (docs/04-ui.md, «Аналитика», ADR-0039): средние lead и cycle time,
 * время в статусах, точность оценок, закрыто по неделям, просрочки. Те же числа —
 * в выгрузке CSV и JSON (`GET …/timings?format=`).
 */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { t } = useT();
const { timings, failure, pending } = useTimings(projectId);
const data = computed(() => timings.value?.analytics ?? null);
const maxWeek = computed(() => Math.max(1, ...(data.value?.weeks ?? []).map((week) => week.closed)));
const STATUSES = ['backlog', 'ready', 'in_progress', 'in_review'];
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">{{ t('ta.title') }}</h1>
      <div class="ml-auto flex gap-2">
        <UButton size="sm" variant="soft" icon="i-lucide-download" :href="`/api/projects/${projectId}/timings?format=csv`" external>CSV</UButton>
        <UButton size="sm" variant="soft" icon="i-lucide-download" :href="`/api/projects/${projectId}/timings?format=json`" external>JSON</UButton>
      </div>
    </div>
    <p class="text-sm text-muted">{{ t('ta.hint') }} {{ timings?.timezone ? t('ta.timezone', { tz: timings.timezone }) : t('ta.noTimezone') }}</p>

    <ProjectFailure v-if="failure" :failure="failure" />
    <USkeleton v-else-if="pending && !data" class="h-40 w-full" />

    <template v-else-if="data">
      <div class="grid gap-4 lg:grid-cols-2">
        <UCard v-for="block in [{ title: t('ta.byChange'), rows: data.byChange }, { title: t('ta.byRole'), rows: data.byRole }]" :key="block.title">
          <template #header><h2 class="font-medium">{{ block.title }}</h2></template>
          <p v-if="block.rows.length === 0" class="text-sm text-muted">{{ t('ta.empty') }}</p>
          <table v-else class="w-full text-sm">
            <thead class="text-left text-muted"><tr><th>{{ t('ta.key') }}</th><th>{{ t('ta.who') }}</th><th class="text-right">{{ t('ta.count') }}</th><th class="text-right">{{ t('ta.lead') }}</th><th class="text-right">{{ t('ta.cycle') }}</th></tr></thead>
            <tbody>
              <tr v-for="row in block.rows" :key="`${row.agent}|${row.key}`" class="border-t border-default">
                <td class="py-1 font-mono text-xs">{{ row.key }}</td>
                <td>{{ row.agent ? t('ta.agent') : t('ta.human') }}</td>
                <td class="text-right">{{ row.count }}</td>
                <td class="text-right">{{ spanLabel(row.leadAvg) }}</td>
                <td class="text-right">{{ spanLabel(row.cycleAvg) }}</td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium">{{ t('ta.statuses') }}</h2></template>
          <dl class="grid grid-cols-2 gap-2 text-sm">
            <div v-for="status in STATUSES" :key="status"><dt class="text-muted">{{ statusLabel(status) }}</dt><dd>{{ spanLabel(data.statusAvg[status]) }}</dd></div>
          </dl>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium">{{ t('ta.estimates') }}</h2></template>
          <p class="text-sm">
            {{ data.estimates.count ? t('ta.estimatesText', { count: data.estimates.count, ratio: data.estimates.ratioAvg ?? '—', within: data.estimates.withinQuarter }) : t('ta.noEstimates') }}
          </p>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium">{{ t('ta.weeks') }}</h2></template>
          <ul class="space-y-1 text-sm">
            <li v-for="week in data.weeks" :key="week.week" class="flex items-center gap-2">
              <span class="w-24 font-mono text-xs text-muted">{{ week.week }}</span>
              <span class="h-2 rounded-full bg-primary" :style="{ width: `${(week.closed / maxWeek) * 70}%`, minWidth: week.closed ? '4px' : '0' }" />
              <span class="text-xs">{{ week.closed }}</span>
            </li>
          </ul>
        </UCard>

        <UCard>
          <template #header><h2 class="font-medium">{{ t('ta.overdue') }}</h2></template>
          <p v-if="data.overdue.length === 0" class="text-sm text-muted">{{ t('ta.noOverdue') }}</p>
          <ul v-else class="space-y-1 text-sm">
            <li v-for="item in data.overdue" :key="item.id" class="flex flex-wrap items-center gap-2">
              <RecordLink :project-id="projectId" :record-id="item.id" />
              <StatusBadge :status="item.status" />
              <LightBadge color="error" variant="subtle">{{ t('tm.overdue', { n: item.overdueDays }) }}</LightBadge>
              <span class="text-xs text-muted">{{ t('tm.due', { date: item.due }) }}</span>
            </li>
          </ul>
        </UCard>
      </div>
    </template>
  </div>
</template>
