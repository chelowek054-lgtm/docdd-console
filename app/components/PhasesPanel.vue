<script setup lang="ts">
import { rankOf, sortPhases } from '~~/server/lib/work-order';
import { matchesPhaseFilter, parsePhaseFilter, PHASE_FILTERS, type PhaseFilter } from '~/utils/phases';
const { t } = useT();
// Вкладка «Фазы» экрана «Работа» (docs/04-ui.md, «Работа: задачи и фазы на одном экране»).
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { failure, records, refresh } = useProjectIndex(projectId);
const { timings } = useTimings(projectId);
const phaseTimings = computed(() => new Map((timings.value?.phases ?? []).map((phase) => [phase.id, phase])));
const { mode } = useOrderMode(records);

/** Статус фазы — посчитанный по задачам, а не из файла (docs/04-ui.md, «Фазы»). */
const router = useRouter();
const filter = computed(() => parsePhaseFilter(route.query['show']));
function setFilter(value: PhaseFilter) {
  const { show: _dropped, ...rest } = route.query;
  router.replace({ query: value === 'all' ? rest : { ...rest, show: value } });
}

const all = computed(() => sortPhases(records.value.filter((record) => record.type === 'phase'), rankOf, mode.value)
  .map((phase) => phaseProgress(phase, records.value)));
const phases = computed(() => all.value.filter((item) => matchesPhaseFilter(item.state, filter.value)));
const counts = computed(() => Object.fromEntries(PHASE_FILTERS.map((item) => [item.value, all.value.filter((phase) => matchesPhaseFilter(phase.state, item.value)).length])));
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">{{ t('t83.phases-panel.1') }}</h2>
        <p class="text-sm text-muted">{{ phases.length }}</p>
        <div class="ml-auto flex flex-wrap items-center gap-1">
          <UButton v-for="item in PHASE_FILTERS" :key="item.value" size="xs" color="neutral" :variant="filter === item.value ? 'solid' : 'ghost'" @click="setFilter(item.value)">{{ item.label }} {{ counts[item.value] }}</UButton>
        </div>
      </div>

      <OverallProgress :records="records" />

      <PhasePlanner :project-id="projectId" :records="records" @changed="refresh" />

      <div v-if="phases.length === 0 && all.length > 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        {{ t('t83.phases-panel.2') }} <UButton size="xs" variant="link" @click="setFilter('all')">{{ t('t83.phases-panel.3') }}</UButton>
      </div>

      <div v-else-if="phases.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        {{ t('t83.phases-panel.4') }} <code>phase</code>{{ t('t83.phases-panel.5') }} <code>covers</code> {{ t('t83.phases-panel.6') }} <code>phase</code> {{ t('t83.phases-panel.7') }}
      </div>

      <ul v-if="phases.length" class="space-y-3">
        <li v-for="item in phases" :key="item.phase.path">
          <UCard>
            <div class="flex flex-wrap items-center gap-3">
              <span v-if="mode === 'importance' && rankOf(item.phase)" class="font-mono text-xs text-muted" :title="t('t83.phases-panel.8')">№{{ rankOf(item.phase) }}</span>
              <RecordLink :project-id="projectId" :record-id="item.phase.id" :record="item.phase" />
              <LightBadge :color="statusColor(item.state)" variant="subtle">{{ statusLabel(item.state) }}</LightBadge>
              <span v-if="item.phase.owner" class="text-xs text-muted" :title="t('t83.phases-panel.9')">{{ item.phase.owner }}</span>
              <!-- Срок и прогноз окончания по скорости закрытия (docs/04-ui.md, «Сроки и время задачи»). -->
              <LightBadge v-if="phaseTimings.get(item.phase.id)?.overdueDays" color="error" variant="subtle">{{ t('tm.overdue', { n: phaseTimings.get(item.phase.id)!.overdueDays }) }}</LightBadge>
              <span v-if="phaseTimings.get(item.phase.id)?.due" class="text-xs text-muted">{{ t('tm.due', { date: phaseTimings.get(item.phase.id)!.due }) }}</span>
              <span v-if="phaseTimings.get(item.phase.id)?.forecast && phaseTimings.get(item.phase.id)!.done < phaseTimings.get(item.phase.id)!.total" class="text-xs text-muted" :title="t('tm.perWeek', { n: phaseTimings.get(item.phase.id)!.perWeek })">{{ t('tm.forecast', { date: phaseTimings.get(item.phase.id)!.forecast }) }}</span>
              <span v-if="item.total" class="ml-auto text-sm text-muted">
                {{ t('t83.phases-panel.10', { done: item.done, total: item.total }) }}
              </span>
            </div>

            <p v-if="item.tasks.length === 0" class="mt-3 text-sm text-muted">
              {{ t('t83.phases-panel.11') }} <code>covers</code> {{ t('t83.phases-panel.12') }} <code>phase</code> {{ t('t83.phases-panel.7') }}
            </p>

            <template v-else>
              <!-- Отменённые не в счёт: работы они не прибавляют и не убавляют. -->
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" :aria-valuenow="percent(item.done, item.total)" aria-valuemin="0" aria-valuemax="100">
                <div class="h-full bg-primary" :style="{ width: `${percent(item.done, item.total)}%` }" />
              </div>

              <p v-if="item.open.length" class="mt-3 text-sm">
                <span class="text-muted">{{ t('t83.phases-panel.13') }}</span>
                <span v-for="task in item.open" :key="task.path" class="ml-2 inline-flex items-center gap-1">
                  <NuxtLink :to="`/projects/${projectId}/records/${task.id}`" :title="task.title" class="font-mono text-xs hover:underline">{{ task.id }}</NuxtLink>
                  <StatusBadge :status="task.status" />
                </span>
              </p>
              <p v-else class="mt-3 text-sm text-muted">{{ t('t83.phases-panel.14') }}</p>

              <details class="mt-3">
                <summary class="cursor-pointer text-sm text-muted">{{ t('t83.phases-panel.15', { length: item.tasks.length }) }}</summary>
                <ul class="mt-2 space-y-1">
                  <li v-for="task in item.tasks" :key="task.path" class="flex flex-wrap items-center gap-2">
                    <RecordLink :project-id="projectId" :record-id="task.id" :record="task" />
                    <StatusBadge :status="task.status" />
                  </li>
                </ul>
              </details>
            </template>
          </UCard>
        </li>
      </ul>
    </template>
  </div>
</template>
