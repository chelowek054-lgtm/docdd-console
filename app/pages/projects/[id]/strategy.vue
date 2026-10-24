<script setup lang="ts">
import MapsPage from './maps.vue';
import type { ProjectMap } from '~~/server/lib/maps';
import { roadmap } from '~~/server/lib/manager';
import { strategyContours, type HealthLevel, type StrategyCapability } from '~~/server/lib/strategy';

/**
 * «Стратегия» (R-0084, R-0085; docs/04-ui.md): контуры проекта — возможности
 * верхнего уровня стратегической карты (в файлах — функциональной) — со здоровьем из
 * четырёх сигналов. Экран — сама карта (ADR-0035): «Контуры» — карточки, «Карта» — дерево и
 * граф целиком с правкой на месте; клик по контуру открывает его поддерево.
 */
const route = useRoute();
const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { index, records } = useProjectIndex(projectId);
// Ссылка `?open=<id>` ведёт сразу в дерево.
const view = ref<'contours' | 'map'>(route.query['open'] ? 'map' : 'contours');

const { data: mapData, pending } = useFetch<Partial<ProjectMap>>(() => `/api/projects/${projectId.value}/map?kind=functional`, { key: () => `strategy-map:${projectId.value}`, server: false, lazy: true });

const contours = computed(() => {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = new Map(roadmap(records.value, today).filter((phase) => phase.overdueDays > 0).map((phase) => [phase.id, phase.overdueDays]));
  return strategyContours({
    capabilities: (mapData.value?.functional?.capabilities ?? []) as StrategyCapability[],
    records: records.value,
    results: index.value?.verificationResults ?? {},
    issues: index.value?.issues ?? [],
    overdue
  });
});

const COLOR: Record<HealthLevel, 'success' | 'warning' | 'error'> = { ok: 'success', attention: 'warning', problem: 'error' };
/** Классы — целиком, а не склейкой: Tailwind видит только написанные строки. */
const TEXT: Record<HealthLevel, string> = { ok: 'text-success', attention: 'text-warning', problem: 'text-error' };
const ICON: Record<HealthLevel, string> = { ok: 'i-lucide-circle-check', attention: 'i-lucide-circle-alert', problem: 'i-lucide-circle-x' };
const counts = computed(() => ({
  problem: contours.value.filter((item) => item.health.level === 'problem').length,
  attention: contours.value.filter((item) => item.health.level === 'attention').length
}));
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-baseline gap-3">
      <h1 class="text-xl font-semibold">{{ t('st2.title') }}</h1>
      <p class="text-sm text-muted">{{ t('st2.hint') }}</p>
      <span class="ml-auto flex gap-2 text-sm">
        <UBadge v-if="counts.problem" color="error" variant="soft">{{ t('st2.problems', { n: counts.problem }) }}</UBadge>
        <UBadge v-if="counts.attention" color="warning" variant="soft">{{ t('st2.attention', { n: counts.attention }) }}</UBadge>
      </span>
    </div>

    <UTabs v-model="view" size="xs" class="w-56" :items="[{ label: t('st2.view.contours'), value: 'contours' }, { label: t('st2.view.map'), value: 'map' }]" />

    <!-- Намерение одной фразой (ADR-0037): на карточках контуров; на «Карте» строку показывает сама карта. -->
    <!-- Отметки, отставшие от закрытых задач, — одним черновиком карты (R-0101). -->
    <BehindMarks :project-id="projectId" />

    <StrategyIntent v-if="view === 'contours'" :project-id="projectId" :contours="contours.map((item) => ({ id: item.id, title: item.title }))" />

    <MapsPage v-if="view === 'map'" scope="strategic" />

    <p v-else-if="pending && !contours.length" class="text-sm text-muted">{{ t('st2.loading') }}</p>
    <div v-else-if="!contours.length" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">{{ t('st2.empty') }}</div>

    <div v-if="view === 'contours'" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <UCard v-for="contour in contours" :key="contour.id" :ui="{ body: 'space-y-3' }">
        <div class="flex items-start gap-2">
          <UIcon :name="ICON[contour.health.level]" class="mt-0.5 size-5 shrink-0" :class="TEXT[contour.health.level]" />
          <div class="min-w-0 flex-1">
            <NuxtLink :to="`/projects/${projectId}/strategy?open=${encodeURIComponent(contour.id)}`" class="font-medium hover:text-primary" @click="view = 'map'">{{ contour.title }}</NuxtLink>
            <p v-if="contour.summary" class="text-xs text-muted">{{ contour.summary }}</p>
          </div>
          <UBadge :color="COLOR[contour.health.level]" variant="soft" size="sm">{{ t(`st2.level.${contour.health.level}`) }}</UBadge>
        </div>

        <div class="flex items-center gap-3">
          <UProgress :model-value="contour.percent" :max="100" size="sm" class="flex-1" />
          <span class="shrink-0 text-xs text-muted">{{ t('st2.progress', { done: contour.progress.implemented, total: contour.progress.total }) }}</span>
        </div>

        <p class="flex items-center gap-1 text-xs text-muted">
          <UIcon name="i-lucide-user" class="size-3.5" />{{ contour.owner ? t('st2.owner', { owner: contour.owner }) : t('st2.noOwner') }}
        </p>

        <ul v-if="contour.health.reasons.length" class="space-y-0.5 text-xs">
          <li v-for="(reason, at) in contour.health.reasons.slice(0, 5)" :key="at" class="flex gap-1" :class="reason.level === 'problem' ? 'text-error' : 'text-warning'">
            <span class="shrink-0 text-muted">{{ t(`st2.signal.${reason.signal}`) }}:</span>
            <NuxtLink v-if="reason.recordId" :to="`/projects/${projectId}/records/${reason.recordId}`" class="hover:underline">{{ reason.text }}</NuxtLink>
            <span v-else>{{ reason.text }}</span>
          </li>
          <li v-if="contour.health.reasons.length > 5" class="text-muted">{{ t('st2.more', { n: contour.health.reasons.length - 5 }) }}</li>
        </ul>
      </UCard>
    </div>
  </div>
</template>
