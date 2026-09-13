<script setup lang="ts">
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { failure, records } = useProjectIndex(projectId);

/** Статус фазы — посчитанный по задачам, а не из файла (docs/04-ui.md, «Фазы»). */
const phases = computed(() => records.value
  .filter((record) => record.type === 'phase')
  .sort((a, b) => a.id.localeCompare(b.id))
  .map((phase) => phaseProgress(phase, records.value)));

function percent(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100);
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Фазы</h1>
        <p class="text-sm text-muted">{{ phases.length }}</p>
      </div>

      <div v-if="phases.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Фаз в проекте нет. Фаза — запись типа <code>phase</code>; задачи входят в неё
        связью <code>covers</code> у фазы или полем <code>phase</code> у задачи.
      </div>

      <ul v-else class="space-y-3">
        <li v-for="item in phases" :key="item.phase.path">
          <UCard>
            <div class="flex flex-wrap items-center gap-3">
              <RecordLink :project-id="projectId" :record-id="item.phase.id" :record="item.phase" />
              <UBadge :color="statusColor(item.state)" variant="subtle" size="sm">{{ statusLabel(item.state) }}</UBadge>
              <span v-if="item.total" class="ml-auto text-sm text-muted">
                закрыто {{ item.done }} из {{ item.total }}
              </span>
            </div>

            <p v-if="item.tasks.length === 0" class="mt-3 text-sm text-muted">
              Состав пуст — задайте <code>covers</code> у фазы или <code>phase</code> у задачи.
            </p>

            <template v-else>
              <!-- Отменённые не в счёт: работы они не прибавляют и не убавляют. -->
              <div class="mt-3 h-2 overflow-hidden rounded-full bg-elevated" role="progressbar" :aria-valuenow="percent(item.done, item.total)" aria-valuemin="0" aria-valuemax="100">
                <div class="h-full bg-success" :style="{ width: `${percent(item.done, item.total)}%` }" />
              </div>

              <p v-if="item.open.length" class="mt-3 text-sm">
                <span class="text-muted">Мешает закрыть:</span>
                <span v-for="task in item.open" :key="task.path" class="ml-2 inline-flex items-center gap-1">
                  <NuxtLink :to="`/projects/${projectId}/records/${task.id}`" :title="task.title" class="font-mono text-xs hover:underline">{{ task.id }}</NuxtLink>
                  <StatusBadge :status="task.status" />
                </span>
              </p>
              <p v-else class="mt-3 text-sm text-muted">Все задачи состава закрыты или отменены.</p>

              <details class="mt-3">
                <summary class="cursor-pointer text-sm text-muted">Состав: {{ item.tasks.length }}</summary>
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
