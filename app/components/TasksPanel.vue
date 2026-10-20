<script setup lang="ts">
import { sortTasks } from '~~/server/lib/work-order';
// Вкладка «Задачи» экрана «Работа» (docs/04-ui.md, «Работа: задачи и фазы на одном экране»).
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, byId, refresh, patchStatuses } = useProjectIndex(projectId);

const { mode } = useOrderMode(records);
const tasks = computed(() => sortTasks(records.value.filter((record) => record.type === 'task'), records.value, mode.value));

const statuses = computed(() => tasks.value.map((task) => task.status));
const status = useStatusFilter(statuses);
const phase = ref<string>('');
const owner = ref<string>('');
const tag = ref<string>('');
const reviewers = useTaskReviewers(tasks, index);
// «Мои задачи»: без входа имя вводится вручную и помнится в браузере (T-0016).
const me = ref('');
const mineOnly = ref(false);
onMounted(() => { try { me.value = localStorage.getItem('docdd.me') ?? ''; } catch { /* хранилище недоступно */ } });
watch(me, (value) => { try { localStorage.setItem('docdd.me', value); } catch { /* не страшно */ } });

const phases = computed(() => unique(tasks.value.map((task) => task.phase ?? '')));
const owners = computed(() => unique(tasks.value.map((task) => task.owner ?? '')));
const tags = computed(() => unique(tasks.value.flatMap((task) => task.tags)));

const shown = computed(() => tasks.value.filter((task) =>
  (!status.value || task.status === status.value)
  && (!phase.value || task.phase === phase.value)
  && (!owner.value || task.owner === owner.value)
  && (!tag.value || task.tags.includes(tag.value)) && reviewers.matches(task)
  && (!mineOnly.value || !me.value || task.extra['assignee'] === me.value)));

const selection = useSelection(shown);
const chunk = useChunked(shown, 40);
const onBulkDone = (results?: BulkMoved[]) => { selection.clear(); if (results) patchStatuses(results); else void refresh(); };

/** Результаты проверок нужны, чтобы не выдавать объявленное за подтверждённое. */
const results = computed(() => index.value?.verificationResults ?? {});

const unique = (values: string[]): string[] => [...new Set(values.filter(Boolean))].sort();

/**
 * Задачи очереди, чья опора ещё не подтверждена: в `ready` они не уйдут, и
 * «Вперёд» их пропустит. Работа идёт сверху вниз — сначала требования и
 * документы (docs/04-ui.md, «Массовые действия»).
 */
const waiting = computed(() => shown.value
  .filter((task) => task.status === 'backlog')
  .map((task) => ({
    task,
    needs: [...(task.links.implements ?? []), ...(task.links.documents ?? []), ...(task.links.refines ?? [])]
      .filter((id) => {
        const target = byId.value.get(id);
        return target !== undefined && target.status !== 'approved';
      })
  }))
  .filter((entry) => entry.needs.length > 0));

function reset() {
  status.value = '';
  phase.value = '';
  owner.value = '';
  tag.value = '';
  reviewers.reviewer.value = '';
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">Задачи</h2>
        <p class="text-sm text-muted">{{ shown.length }} из {{ tasks.length }}</p>
        <ReviewBatchPrompt v-if="status === 'in_review'" class="ml-auto" :project-id="projectId" :visible-ids="shown.map((task) => task.id)" :total="tasks.filter((task) => task.status === 'in_review').length" />
        <NewRecord :class="status === 'in_review' ? '' : 'ml-auto'" :project-id="projectId" type="task" :records="records" @created="refresh" />
      </div>

      <!-- Общие: фильтры ниже на них не влияют (docs/04-ui.md, «Общие шкалы»). -->
      <OverallProgress :records="records" />

      <StatusTabs v-model="status" :statuses="statuses" :order="TASK_STATUS_ORDER" />

      <div class="flex flex-wrap gap-2">
        <!-- Пустое значение USelect запрещает: «ничего не выбрано» — подсказка, снимается «Сбросить». -->
        <USelect v-model="phase" placeholder="Любая фаза" :items="phases.map((p) => ({ label: p, value: p }))" class="w-40" />
        <USelect v-model="owner" placeholder="Любой исполнитель" :items="owners.map((o) => ({ label: o, value: o }))" class="w-48" />
        <USelect v-model="reviewers.reviewer.value" placeholder="Любой ревьюер" :items="reviewers.reviewers.value" class="w-44" />
        <USelect v-model="tag" placeholder="Любой тег" :items="tags.map((t) => ({ label: t, value: t }))" class="w-40" />
        <UInput v-model="me" placeholder="Моё имя" class="w-36" />
        <UCheckbox v-model="mineOnly" label="Мои задачи" />
        <UButton variant="ghost" color="neutral" @click="reset">Сбросить</UButton>
      </div>

      <!-- Отмечено — разбиваются отмеченные, не отмечено ничего — все, что ещё
           ни в какой фазе (docs/04-ui.md, «Разбить на фазы»). -->
      <PhasePlanner
        :project-id="projectId"
        :records="records"
        :picked="selection.selected.value.map((task) => task.id)"
        @changed="refresh"
      />

      <UAlert
        v-if="waiting.length"
        color="info"
        variant="subtle"
        icon="i-lucide-info"
        :title="`У ${waiting.length} задач из очереди опора ещё не подтверждена`"
        description="Сначала подтвердите требования и документы, на которые они опираются, — иначе «Вперёд» эти задачи пропустит и назовёт причину."
      />

      <BulkBar
        :project-id="projectId"
        :selected="selection.selected.value"
        :total="shown.length"
        :roles="index?.project.roles ?? []"
        kind="task"
        @done="onBulkDone"
      />

      <div v-if="shown.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        Под фильтры не попала ни одна задача. Снимите фильтры или заведите задачу в проекте — приложение записей не создаёт.
      </div>

      <div v-else class="rounded-lg border border-default">
        <div class="border-b border-default px-4 py-2">
          <UCheckbox
            :model-value="selection.state.value"
            label="Выбрать всё"
            @update:model-value="selection.toggleAll()"
          />
        </div>

        <ul class="divide-y divide-default">
        <li v-for="task in chunk.visible.value" :key="task.path" class="flex gap-3 p-4">
          <UCheckbox
            class="pt-0.5"
            :model-value="selection.has(task.id)"
            :aria-label="`Отметить ${task.id}`"
            @update:model-value="selection.set(task.id, $event)"
          />
          <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-3">
            <RecordLink :project-id="projectId" :record-id="task.id" :record="task" />
            <StatusBadge :status="task.status" /><DiffUnviewed :project-id="projectId" :record-id="task.id" :status="task.status" />
            <LightBadge v-if="taskFact(task, results)" :color="taskFact(task, results)!.color" variant="subtle">
              {{ taskFact(task, results)!.label }}
            </LightBadge>
            <LightBadge v-if="task.phase" color="neutral" variant="subtle">{{ task.phase }}</LightBadge>
            <LightBadge v-for="name in task.tags" :key="name" color="neutral" variant="outline">{{ name }}</LightBadge>
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
            <LightBadge v-else color="warning" variant="subtle">без требования</LightBadge>

            <span v-if="task.links.verified_by?.length">
              проверяется:
              <template v-for="id in task.links.verified_by" :key="id">
                <NuxtLink :to="`/projects/${projectId}/records/${id}`" class="ml-1 font-mono hover:underline">{{ id }}</NuxtLink>
                <LightBadge
                  v-if="results[id]"
                  :color="statusColor(results[id]!.state)"
                  variant="subtle"
                  class="ml-1"
                >{{ resultLabel(results[id]!.state) }}</LightBadge>
                <LightBadge v-else color="neutral" variant="subtle" class="ml-1">не запускалась</LightBadge>
              </template>
            </span>
            <span v-else>без проверки</span>
            <span v-if="reviewers.label(task)">ревьюер: <span class="text-default">{{ reviewers.label(task) }}</span></span>
          </div>
          </div>
        </li>
        </ul>
        <div v-if="chunk.rest.value > 0" class="border-t border-default p-3 text-center">
          <UButton variant="ghost" color="neutral" @click="chunk.more()">Показать ещё {{ Math.min(chunk.step, chunk.rest.value) }}</UButton>
        </div>
      </div>
    </template>
  </div>
</template>
