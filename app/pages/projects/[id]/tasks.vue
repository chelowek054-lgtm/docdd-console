<script setup lang="ts">
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, refresh } = useProjectIndex(projectId);

const tasks = computed(() => records.value.filter((record) => record.type === 'task'));

const status = ref<string>('');
const phase = ref<string>('');
const owner = ref<string>('');
const tag = ref<string>('');

const statuses = computed(() => unique(tasks.value.map((task) => task.status)));
const phases = computed(() => unique(tasks.value.map((task) => task.phase ?? '')));
const owners = computed(() => unique(tasks.value.map((task) => task.owner ?? '')));
const tags = computed(() => unique(tasks.value.flatMap((task) => task.tags)));

const shown = computed(() => tasks.value.filter((task) =>
  (!status.value || task.status === status.value)
  && (!phase.value || task.phase === phase.value)
  && (!owner.value || task.owner === owner.value)
  && (!tag.value || task.tags.includes(tag.value))));

/** Результаты проверок нужны, чтобы не выдавать объявленное за подтверждённое. */
const results = computed(() => index.value?.verificationResults ?? {});

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

function reset() {
  status.value = '';
  phase.value = '';
  owner.value = '';
  tag.value = '';
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Задачи</h1>
        <p class="text-sm text-muted">{{ shown.length }} из {{ tasks.length }}</p>
        <NewRecord class="ml-auto" :project-id="projectId" type="task" :records="records" @created="refresh" />
      </div>

      <div class="flex flex-wrap gap-2">
        <!-- Пустое значение в списке библиотека запрещает: «ничего не выбрано»
             показывается подсказкой, а снимается кнопкой «Сбросить». -->
        <USelect v-model="status" placeholder="Любой статус" :items="statuses.map((s) => ({ label: statusLabel(s), value: s }))" class="w-48" />
        <USelect v-model="phase" placeholder="Любая фаза" :items="phases.map((p) => ({ label: p, value: p }))" class="w-40" />
        <USelect v-model="owner" placeholder="Любой исполнитель" :items="owners.map((o) => ({ label: o, value: o }))" class="w-48" />
        <USelect v-model="tag" placeholder="Любой тег" :items="tags.map((t) => ({ label: t, value: t }))" class="w-40" />
        <UButton variant="ghost" color="neutral" @click="reset">Сбросить</UButton>
      </div>

      <div v-if="shown.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Под фильтры не попала ни одна задача. Снимите фильтры или заведите задачу в проекте — приложение записей не создаёт.
      </div>

      <ul v-else class="divide-y divide-default rounded-lg border border-default">
        <li v-for="task in shown" :key="task.path" class="p-4">
          <div class="flex flex-wrap items-center gap-3">
            <RecordLink :project-id="projectId" :record-id="task.id" :record="task" />
            <StatusBadge :status="task.status" />
            <UBadge v-if="task.phase" color="neutral" variant="subtle" size="sm">{{ task.phase }}</UBadge>
            <UBadge v-for="name in task.tags" :key="name" color="neutral" variant="outline" size="sm">{{ name }}</UBadge>
            <span v-if="task.owner" class="text-sm text-muted">{{ task.owner }}</span>
          </div>

          <div class="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted">
            <span v-if="task.links.implements?.length">
              выполняет:
              <NuxtLink
                v-for="id in task.links.implements"
                :key="id"
                :to="`/projects/${projectId}/records/${id}`"
                class="ml-1 font-mono hover:underline"
              >{{ id }}</NuxtLink>
            </span>
            <!-- Задача без требования помечена: это и есть работа, которая
                 никому не понадобилась (docs/04-ui.md). -->
            <UBadge v-else color="warning" variant="subtle" size="sm">без требования</UBadge>

            <span v-if="task.links.verified_by?.length">
              проверяется:
              <template v-for="id in task.links.verified_by" :key="id">
                <NuxtLink :to="`/projects/${projectId}/records/${id}`" class="ml-1 font-mono hover:underline">{{ id }}</NuxtLink>
                <UBadge
                  v-if="results[id]"
                  :color="statusColor(results[id]!.state)"
                  variant="subtle"
                  size="sm"
                  class="ml-1"
                >{{ RESULT_LABELS[results[id]!.state] }}</UBadge>
                <UBadge v-else color="neutral" variant="subtle" size="sm" class="ml-1">не запускалась</UBadge>
              </template>
            </span>
            <span v-else>без проверки</span>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
