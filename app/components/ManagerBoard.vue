<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';
import { BOARD_COLUMNS, NO_ASSIGNEE, STATUS_WORD, boardColumns } from '~~/server/lib/manager';
import { reviewerOf, roleName } from '~~/server/lib/reviewer';

/**
 * Доска задач по статусам (T-0032; docs/04-ui.md, «Менеджер и Релизы»). Перенос
 * карточки — тот же маршрут смены статуса, что и кнопка в записи: правила
 * переходов не обходятся, причина отказа показывается перечнем.
 */
const props = defineProps<{ projectId: string; records: IndexRecord[]; roles?: { id: string; name: string }[] }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

/** Пустое значение выпадающему списку нельзя — «все» обозначены отдельным словом. */
const ALL = 'all';
const phase = ref(ALL);
const assignee = ref(ALL);
const capability = ref(ALL);
const failure = ref<ApiFailure | null>(null);
const dragged = ref('');
const DONE_LIMIT = 10;
const showAllDone = ref(false);

const phases = computed(() => props.records.filter((record) => record.type === 'phase'));
const phaseTitle = computed(() => new Map(phases.value.map((record) => [record.id, record.title])));
const tasks = computed(() => props.records.filter((record) => record.type === 'task'));
const assignees = computed(() => [...new Set(tasks.value.map((r) => r.extra['assignee']).filter((v): v is string => typeof v === 'string' && v !== ''))].sort());
const capabilities = computed(() => [...new Set(tasks.value.flatMap((r) => r.links.affects ?? []))].sort());

const phaseItems = computed(() => [{ label: t('mb.allPhases'), value: ALL }, ...phases.value.map((p) => ({ label: `${p.id} · ${p.title}`, value: p.id }))]);
const assigneeItems = computed(() => [{ label: t('mb.allAssignees'), value: ALL }, { label: t('mb.noAssignee'), value: NO_ASSIGNEE }, ...assignees.value.map((a) => ({ label: a, value: a }))]);
const capabilityItems = computed(() => [{ label: t('mb.allCaps'), value: ALL }, ...capabilities.value.map((c) => ({ label: c, value: c }))]);

const filter = (value: string) => (value === ALL ? '' : value);
const columns = computed(() => boardColumns(props.records, { phase: filter(phase.value), assignee: filter(assignee.value), capability: filter(capability.value) }));

/** «Сделано» растёт без конца: новые сверху, по умолчанию — последние десять. */
function visible(status: string): IndexRecord[] {
  const list = columns.value[status] ?? [];
  if (status !== 'done') return list;
  const newest = [...list].reverse();
  return showAllDone.value ? newest : newest.slice(0, DONE_LIMIT);
}

function phaseOf(task: IndexRecord): string {
  if (task.phase) return task.phase;
  return phases.value.find((p) => (p.links.covers ?? []).includes(task.id))?.id ?? '';
}
function assigneeOf(task: IndexRecord): string {
  const value = task.extra['assignee'];
  return typeof value === 'string' ? value : '';
}
function reviewer(task: IndexRecord): string {
  const pick = reviewerOf(task, props.records, props.roles ?? []);
  return pick ? roleName(pick.role, props.roles ?? []) : '';
}

async function drop(status: string) {
  const id = dragged.value;
  dragged.value = '';
  if (!id) return;
  failure.value = null;
  const response = await $fetch<{ error?: ApiFailure }>(`/api/projects/${props.projectId}/records/${id}/status`, { method: 'POST', body: { status }, ignoreResponseError: true });
  if (response?.error) failure.value = response.error;
  else emit('changed');
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2">
      <USelect v-model="phase" :items="phaseItems" class="w-full sm:w-64" />
      <USelect v-model="assignee" :items="assigneeItems" class="w-full sm:w-52" />
      <USelect v-model="capability" :items="capabilityItems" class="w-full sm:w-52" />
    </div>
    <div v-if="failure" class="ds-card ds-card--error p-3 text-sm text-error">
      <p>{{ failure.message }}</p>
      <ul v-if="failure.blockers?.length" class="list-disc pl-5"><li v-for="(b, at) in failure.blockers" :key="at">{{ b.message }}</li></ul>
    </div>
    <div class="grid gap-3 md:grid-cols-5">
      <section
        v-for="status in BOARD_COLUMNS"
        :key="status"
        class="flex max-h-[70vh] min-h-24 flex-col rounded-lg border border-default bg-elevated/40 p-2"
        @dragover.prevent
        @drop="drop(status)"
      >
        <h2 class="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
          {{ STATUS_WORD[status] }}
          <UBadge color="neutral" variant="soft" size="sm">{{ columns[status]?.length ?? 0 }}</UBadge>
        </h2>
        <div class="min-h-0 flex-1 space-y-2 overflow-y-auto">
          <NuxtLink
            v-for="task in visible(status)"
            :key="task.id"
            :to="`/projects/${props.projectId}/records/${task.id}`"
            draggable="true"
            class="block rounded-md border border-default bg-default p-2 text-xs hover:border-primary"
            @dragstart="dragged = task.id"
          >
            <span class="font-mono text-muted">{{ task.id }}</span>
            <span class="mt-0.5 block text-sm leading-snug">{{ task.title }}</span>
            <span class="mt-1.5 flex flex-wrap items-center gap-1">
              <UBadge v-if="assigneeOf(task)" color="primary" variant="soft" size="sm" icon="i-lucide-user">{{ assigneeOf(task) }}</UBadge>
              <UBadge v-else-if="status !== 'done'" color="warning" variant="soft" size="sm">{{ t('mb.unassigned') }}</UBadge>
              <UBadge v-if="phaseOf(task)" color="neutral" variant="outline" size="sm" :title="phaseTitle.get(phaseOf(task))">{{ phaseOf(task) }}</UBadge>
              <UBadge v-if="status === 'in_review' && reviewer(task)" color="info" variant="soft" size="sm" icon="i-lucide-user-check">{{ reviewer(task) }}</UBadge>
            </span>
          </NuxtLink>
          <UButton
            v-if="status === 'done' && (columns.done?.length ?? 0) > DONE_LIMIT"
            size="xs"
            variant="ghost"
            color="neutral"
            block
            @click="showAllDone = !showAllDone"
          >
            {{ showAllDone ? t('mb.showLess') : t('mb.showAll', { n: columns.done?.length ?? 0 }) }}
          </UButton>
        </div>
      </section>
    </div>
  </div>
</template>
