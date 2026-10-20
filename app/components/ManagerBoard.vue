<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';
import { BOARD_COLUMNS, STATUS_WORD, boardColumns } from '~~/server/lib/manager';

/**
 * Доска задач по статусам (T-0032). Перенос карточки — тот же маршрут смены
 * статуса, что и кнопка в записи: правила переходов не обходятся, причина отказа
 * показывается перечнем.
 */
const props = defineProps<{ projectId: string; records: IndexRecord[] }>();
const emit = defineEmits<{ changed: [] }>();

const phase = ref('');
const assignee = ref('');
const capability = ref('');
const failure = ref<ApiFailure | null>(null);
const dragged = ref('');

const phases = computed(() => props.records.filter((record) => record.type === 'phase'));
const assignees = computed(() => [...new Set(props.records.filter((r) => r.type === 'task').map((r) => r.extra['assignee']).filter((v): v is string => typeof v === 'string'))]);
const capabilities = computed(() => [...new Set(props.records.filter((r) => r.type === 'task').flatMap((r) => r.links.affects ?? []))].sort());
const columns = computed(() => boardColumns(props.records, { phase: phase.value, assignee: assignee.value, capability: capability.value }));

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
    <div class="flex flex-wrap gap-2 text-sm">
      <select v-model="phase" class="rounded border border-default bg-default p-1"><option value="">Все фазы</option><option v-for="p in phases" :key="p.id" :value="p.id">{{ p.id }} · {{ p.title }}</option></select>
      <select v-model="assignee" class="rounded border border-default bg-default p-1"><option value="">Все исполнители</option><option v-for="a in assignees" :key="a" :value="a">{{ a }}</option></select>
      <select v-model="capability" class="rounded border border-default bg-default p-1"><option value="">Все возможности</option><option v-for="c in capabilities" :key="c" :value="c">{{ c }}</option></select>
    </div>
    <div v-if="failure" class="rounded border border-error p-3 text-sm text-error">
      <p>{{ failure.message }}</p>
      <ul v-if="failure.blockers?.length" class="list-disc pl-5"><li v-for="(b, at) in failure.blockers" :key="at">{{ b.message }}</li></ul>
    </div>
    <div class="grid gap-3 md:grid-cols-5">
      <div v-for="status in BOARD_COLUMNS" :key="status" class="min-h-24 rounded border border-default p-2" @dragover.prevent @drop="drop(status)">
        <h2 class="mb-2 text-sm font-semibold">{{ STATUS_WORD[status] }} · {{ columns[status]?.length ?? 0 }}</h2>
        <NuxtLink v-for="task in columns[status]" :key="task.id" :to="`/projects/${props.projectId}/records/${task.id}`" draggable="true" class="mb-2 block rounded border border-default p-2 text-xs" @dragstart="dragged = task.id">
          <span class="font-mono">{{ task.id }}</span> {{ task.title }}
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
