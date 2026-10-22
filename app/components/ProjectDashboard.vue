<script setup lang="ts">
import { buildOverview, type PhaseStage } from '~~/server/lib/overview';
import type { ProjectMap } from '~~/server/lib/maps';

/**
 * Обзор реального проекта (docs/04-ui.md, «Обзор»): готово ли обещанное, что в
 * проде, что делается и проверяется, здорова ли система. Цифры считает
 * server/lib/overview.ts, каждая ведёт к своему списку.
 */
const props = defineProps<{ projectId: string }>();
const { t, locale } = useT();
const { index, records } = useProjectIndex(() => props.projectId);

const overview = computed(() => buildOverview(records.value, index.value?.verificationResults ?? {}, index.value?.issues ?? []));
const base = computed(() => `/projects/${props.projectId}`);

// Возможности и метрики — после показа: странице они не нужны для первой отрисовки.
const { data: mapData } = useFetch<Partial<ProjectMap>>(() => `/api/projects/${props.projectId}/map?kind=functional`, { key: () => `dash-map:${props.projectId}`, server: false, lazy: true });
const capabilities = computed(() => {
  const all = mapData.value?.functional?.capabilities ?? [];
  const parents = new Set(all.map((item) => item.parent).filter(Boolean));
  const leaves = all.filter((item) => !parents.has(item.id));
  const count = (status: string) => leaves.filter((item) => item.status === status).length;
  const implemented = count('implemented');
  return { total: leaves.length, implemented, partial: count('partial'), notImplemented: count('not_implemented'), percent: leaves.length ? Math.round((implemented / leaves.length) * 100) : 0 };
});

interface Observability { configured: boolean; dashboard: string | null; metrics: { id: string; label: string; unit: string; value: number | null; warn: number | null; error?: string }[] }
const { data: obs } = useFetch<Observability>(() => `/api/projects/${props.projectId}/observability`, { key: () => `obs:${props.projectId}`, server: false, lazy: true });

const TASK_SEGMENTS = [
  { status: 'backlog', color: 'bg-neutral-300 dark:bg-neutral-600' },
  { status: 'ready', color: 'bg-sky-400' },
  { status: 'in_progress', color: 'bg-amber-400' },
  { status: 'in_review', color: 'bg-violet-400' },
  { status: 'done', color: 'bg-emerald-500' }
] as const;
const taskTotal = computed(() => TASK_SEGMENTS.reduce((sum, segment) => sum + (overview.value.tasks.byStatus[segment.status] ?? 0), 0));

/** Сначала незакрытые фазы — они требуют внимания; закрытые и выложенные в прод — следом. Порядок внутри — как в плане. */
const PHASES_SHOWN = 5;
const allPhases = ref(false);
const orderedPhases = computed(() => {
  const finished = (stage: PhaseStage) => stage === 'closed' || stage === 'prod';
  return [...overview.value.phases.filter((phase) => !finished(phase.stage)), ...overview.value.phases.filter((phase) => finished(phase.stage))];
});
const shownPhases = computed(() => (allPhases.value ? orderedPhases.value : orderedPhases.value.slice(0, PHASES_SHOWN)));

const STAGE_COLOR: Record<PhaseStage, 'success' | 'info' | 'warning' | 'primary' | 'neutral'> = {
  prod: 'success', stage: 'info', review: 'warning', development: 'primary', not_started: 'neutral', closed: 'neutral'
};

const dateTime = (value: string) => new Date(value).toLocaleString(locale.value === 'en' ? 'en-GB' : 'ru-RU', { dateStyle: 'short', timeStyle: 'short' });
const formatValue = (value: number) => (Math.abs(value) >= 100 ? Math.round(value).toLocaleString('ru-RU') : value.toFixed(value % 1 ? 1 : 0));
</script>

<template>
  <div class="space-y-4">
    <!-- Сводка: четыре вопроса реального проекта, у каждого — полоса прогресса. -->
    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <NuxtLink :to="`${base}/documents?type=requirement`" class="block">
        <UCard :ui="{ body: 'p-4 space-y-2' }">
          <p class="text-sm text-muted">{{ t('ov.requirements') }}</p>
          <p class="text-3xl font-semibold">{{ overview.requirements.percent }}%</p>
          <UProgress :model-value="overview.requirements.percent" color="success" size="sm" />
          <p class="text-xs text-muted">{{ t('ov.reqLine', { done: overview.requirements.done, total: overview.requirements.total, work: overview.requirements.inWork, none: overview.requirements.noTasks }) }}</p>
        </UCard>
      </NuxtLink>

      <NuxtLink :to="`${base}/work?tab=tasks`" class="block">
        <UCard :ui="{ body: 'p-4 space-y-2' }">
          <p class="text-sm text-muted">{{ t('ov.tasks') }}</p>
          <p class="text-3xl font-semibold">{{ overview.tasks.percent }}%</p>
          <div class="flex h-2 overflow-hidden rounded-full bg-elevated" role="img" :aria-label="t('ov.tasksBar')">
            <div
              v-for="segment in TASK_SEGMENTS"
              :key="segment.status"
              :class="segment.color"
              :style="{ width: taskTotal ? `${((overview.tasks.byStatus[segment.status] ?? 0) / taskTotal) * 100}%` : '0' }"
              :title="`${statusLabel(segment.status)}: ${overview.tasks.byStatus[segment.status] ?? 0}`"
            />
          </div>
          <p class="flex flex-wrap gap-x-3 text-xs text-muted">
            <span v-for="segment in TASK_SEGMENTS" :key="segment.status" class="inline-flex items-center gap-1">
              <span class="inline-block size-2 rounded-full" :class="segment.color" />{{ statusLabel(segment.status) }} {{ overview.tasks.byStatus[segment.status] ?? 0 }}
            </span>
          </p>
        </UCard>
      </NuxtLink>

      <NuxtLink :to="`${base}/verify?tab=checks`" class="block">
        <UCard :ui="{ body: 'p-4 space-y-2' }">
          <p class="text-sm text-muted">{{ t('ov.checks') }}</p>
          <p class="text-3xl font-semibold" :class="overview.checks.failed ? 'text-error' : ''">{{ overview.checks.percent }}%</p>
          <UProgress :model-value="overview.checks.percent" :color="overview.checks.failed ? 'error' : 'success'" size="sm" />
          <p class="text-xs text-muted">{{ t('ov.checksAuto', { passed: overview.checks.auto.passed, total: overview.checks.auto.total }) }} · {{ t('ov.checksManual', { passed: overview.checks.manual.passed, total: overview.checks.manual.total }) }}</p>
          <p class="text-xs" :class="overview.checks.failed ? 'text-error' : 'text-muted'">{{ t('ov.checksBad', { failed: overview.checks.failed, never: overview.checks.neverRun }) }}</p>
        </UCard>
      </NuxtLink>

      <NuxtLink :to="`${base}/maps`" class="block">
        <UCard :ui="{ body: 'p-4 space-y-2' }">
          <p class="text-sm text-muted">{{ t('ov.capabilities') }}</p>
          <p class="text-3xl font-semibold">{{ capabilities.percent }}%</p>
          <UProgress :model-value="capabilities.percent" color="primary" size="sm" />
          <p class="text-xs text-muted">{{ t('ov.capLine', { done: capabilities.implemented, partial: capabilities.partial, none: capabilities.notImplemented }) }}</p>
        </UCard>
      </NuxtLink>
    </div>

    <div class="grid gap-4 xl:grid-cols-3">
      <!-- Фазы — конвейер: где каждая сейчас, от разработки до прода. -->
      <UCard class="xl:col-span-2" :ui="{ body: 'p-0' }">
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="font-medium">{{ t('ov.phases') }}</h2>
            <NuxtLink :to="`${base}/work?tab=phases`" class="ml-auto text-sm text-muted hover:underline">{{ t('ov.all') }}</NuxtLink>
          </div>
        </template>
        <p v-if="!overview.phases.length" class="p-4 text-sm text-muted">{{ t('ov.noPhases') }}</p>
        <ul v-else class="divide-y divide-default">
          <li v-for="phase in shownPhases" :key="phase.id" class="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-2.5 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
            <NuxtLink :to="`${base}/records/${phase.id}`" class="min-w-0 truncate text-sm hover:underline">
              <span class="font-mono text-xs text-muted">{{ phase.id }}</span> {{ phase.title }}
            </NuxtLink>
            <div class="order-3 col-span-2 flex items-center gap-2 sm:order-none sm:col-span-1">
              <UProgress :model-value="phase.percent" size="xs" :color="phase.stage === 'prod' ? 'success' : 'primary'" />
              <span class="w-16 shrink-0 text-right text-xs text-muted">{{ phase.done }}/{{ phase.total }}</span>
            </div>
            <div class="flex items-center justify-end gap-1">
              <LightBadge :color="STAGE_COLOR[phase.stage]" variant="subtle">{{ t(`ov.stage.${phase.stage}`) }}</LightBadge>
              <LightBadge v-if="phase.inReview" color="warning" variant="outline">{{ t('ov.inReview', { n: phase.inReview }) }}</LightBadge>
              <LightBadge v-if="phase.overdueDays" color="error" variant="subtle">{{ t('ov.overdue', { n: phase.overdueDays }) }}</LightBadge>
            </div>
          </li>
        </ul>
        <div v-if="orderedPhases.length > PHASES_SHOWN" class="border-t border-default p-2 text-center">
          <UButton variant="ghost" color="neutral" size="sm" @click="allPhases = !allPhases">
            {{ allPhases ? t('ov.showLess') : t('ov.showMore', { n: orderedPhases.length - PHASES_SHOWN }) }}
          </UButton>
        </div>
      </UCard>

      <!-- Наблюдаемость: важное о живой системе из Prometheus/Grafana. -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="font-medium">{{ t('ov.observability') }}</h2>
            <UButton v-if="obs?.dashboard" :to="obs.dashboard" target="_blank" size="xs" variant="ghost" color="neutral" trailing-icon="i-lucide-external-link" class="ml-auto">Grafana</UButton>
          </div>
        </template>
        <div v-if="obs?.configured" class="grid grid-cols-2 gap-3">
          <div v-for="metric in obs.metrics" :key="metric.id" class="rounded-lg bg-elevated/50 p-3">
            <p class="text-xs text-muted">{{ metric.label }}</p>
            <p v-if="metric.value !== null" class="text-2xl font-semibold" :class="metric.warn !== null && metric.value > metric.warn ? 'text-warning' : ''">
              {{ formatValue(metric.value) }}<span class="text-sm font-normal text-muted">{{ metric.unit }}</span>
            </p>
            <p v-else class="text-sm text-error">{{ metric.error }}</p>
          </div>
        </div>
        <p v-else class="text-sm text-muted">{{ t('ov.obsHint') }}</p>
      </UCard>
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
      <!-- Качество: автотесты и ручные приёмки — разные источники факта, показаны порознь. -->
      <UCard>
        <template #header><h2 class="font-medium">{{ t('ov.quality') }}</h2></template>
        <div class="space-y-3 text-sm">
          <div>
            <p class="text-xs text-muted">{{ t('ov.lastAuto') }}</p>
            <p v-if="overview.lastAutoRun">
              <span class="font-medium">{{ overview.lastAutoRun.runner }}</span> · {{ dateTime(overview.lastAutoRun.at) }} ·
              <span class="text-success">{{ t('ov.passed', { n: overview.lastAutoRun.passed }) }}</span>
              <span v-if="overview.lastAutoRun.failed" class="text-error"> · {{ t('ov.failed', { n: overview.lastAutoRun.failed }) }}</span>
            </p>
            <p v-else class="text-muted">{{ t('ov.noRuns') }}</p>
          </div>
          <div>
            <p class="text-xs text-muted">{{ t('ov.lastManual') }}</p>
            <p v-if="!overview.manual.length" class="text-muted">{{ t('ov.noManual') }}</p>
            <ul v-else class="space-y-1">
              <li v-for="row in overview.manual" :key="row.id" class="truncate" :title="row.note">
                <NuxtLink :to="`${base}/records/${row.id}`" class="font-mono text-xs hover:underline">{{ row.id }}</NuxtLink>
                <span :class="row.state === 'passed' ? 'text-success' : 'text-error'"> · {{ row.by }}</span>
                <span class="text-muted"> · {{ dateTime(row.at) }}</span>
              </li>
            </ul>
          </div>
          <div>
            <p class="text-xs text-muted">{{ t('ov.process') }}</p>
            <p>
              <NuxtLink :to="`${base}/verify?tab=issues`" class="hover:underline">
                <span :class="overview.issues.errors ? 'text-error' : 'text-success'">{{ t('ov.errors', { n: overview.issues.errors }) }}</span> · {{ t('ov.warnings', { n: overview.issues.warnings }) }}
              </NuxtLink>
            </p>
            <p v-if="overview.issues.top.length" class="text-xs text-muted">{{ overview.issues.top.map((item) => `${item.code} ${item.count}`).join(' · ') }}</p>
          </div>
        </div>
      </UCard>

      <!-- Релизы: что и куда выложено. -->
      <UCard>
        <template #header>
          <div class="flex items-center gap-2">
            <h2 class="font-medium">{{ t('ov.releases') }}</h2>
            <NuxtLink :to="`${base}/releases`" class="ml-auto text-sm text-muted hover:underline">{{ t('ov.all') }}</NuxtLink>
          </div>
        </template>
        <p v-if="!overview.releases.length" class="text-sm text-muted">{{ t('ov.noReleases') }}</p>
        <ul v-else class="space-y-2 text-sm">
          <li v-for="release in overview.releases" :key="release.id" class="flex flex-wrap items-center gap-2">
            <NuxtLink :to="`${base}/records/${release.id}`" class="font-medium hover:underline">{{ release.version }}</NuxtLink>
            <LightBadge v-for="environment in release.environments" :key="environment" :color="/prod/i.test(environment) ? 'success' : 'info'" variant="subtle">{{ environment }}</LightBadge>
            <span class="text-xs text-muted">{{ t('ov.shipped', { n: release.tasks }) }}</span>
          </li>
        </ul>
      </UCard>

      <!-- Риски: то, что в реальном проекте всплывает слишком поздно. -->
      <UCard>
        <template #header><h2 class="font-medium">{{ t('ov.risks') }}</h2></template>
        <p v-if="!overview.risks.length" class="text-sm text-success">{{ t('ov.noRisks') }}</p>
        <ul v-else class="space-y-1.5 text-sm">
          <li v-for="risk in overview.risks" :key="risk.kind + risk.id" class="flex gap-2">
            <NuxtLink :to="`${base}/records/${risk.id}`" class="shrink-0 font-mono text-xs hover:underline">{{ risk.id }}</NuxtLink>
            <span class="min-w-0 flex-1 truncate" :title="risk.title">{{ risk.title }}</span>
            <span class="shrink-0 text-xs" :class="risk.kind === 'failed_check' || risk.kind === 'overdue' ? 'text-error' : 'text-warning'">{{ risk.detail }}</span>
          </li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
