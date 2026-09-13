<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { failure, records, byId, refresh } = useProjectIndex(projectId);

/**
 * Проектные документы, решения и контракты — один экран, а не три: вопрос к
 * ним один (подтверждено ли то, на что опирается работа), и схема статусов
 * одна (docs/04-ui.md, «Документы»).
 */
const TABS = [
  { label: 'Все', value: 'all' },
  { label: 'Проектные документы', value: 'design' },
  { label: 'Решения', value: 'decision' },
  { label: 'Контракты', value: 'contract' }
];
const DOCUMENT_TYPES = ['design', 'decision', 'contract'];

/** Вкладка живёт в адресе: пункт шапки ведёт сразу на свою, а не на выбор. */
const type = computed({
  get: () => {
    const value = route.query['type'];
    return typeof value === 'string' && DOCUMENT_TYPES.includes(value) ? value : 'all';
  },
  set: (value: string | number) => {
    const next = String(value);
    router.replace({ query: next === 'all' ? {} : { type: next } });
  }
});

const heading = computed(() => (type.value === 'all'
  ? 'Документы'
  : TABS.find((tab) => tab.value === type.value)?.label ?? 'Документы'));

/**
 * Неподтверждённое наверху: экран открывают, чтобы найти его. Незнакомый
 * статус — в конец, но не пропадает.
 */
const STATUS_ORDER = ['review', 'draft', 'approved', 'superseded', 'dropped', 'rejected'];

function rank(status: string): number {
  const at = STATUS_ORDER.indexOf(status);
  return at === -1 ? STATUS_ORDER.length : at;
}

const documents = computed(() => records.value
  .filter((record) => (type.value === 'all' ? DOCUMENT_TYPES.includes(record.type) : record.type === type.value))
  .sort((a, b) => rank(a.status) - rank(b.status) || a.id.localeCompare(b.id)));

/** Кто опирается: задачи, которые документ правят, и записи, что его уточняют или стоят на решении. */
function reliedOnBy(document: IndexRecord): string[] {
  return [...new Set([
    ...(document.backlinks.documents ?? []),
    ...(document.backlinks.refines ?? []),
    ...(document.backlinks.decided_by ?? [])
  ])].sort();
}

const EMPTY: Record<string, string> = {
  all: 'Проектных документов, решений и контрактов в проекте нет.',
  design: 'Проектных документов в проекте нет.',
  decision: 'Решений в проекте нет.',
  contract: 'Контрактов в проекте нет.'
};
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">{{ heading }}</h1>
        <p class="text-sm text-muted">{{ documents.length }}</p>
        <!-- Тип выбирается вкладкой, а не полем формы: на «Все» кнопки нет. -->
        <NewRecord
          v-if="type !== 'all'"
          :key="type"
          class="ml-auto"
          :project-id="projectId"
          :type="type"
          :records="records"
          @created="refresh"
        />
      </div>

      <UTabs v-model="type" :items="TABS" :content="false" />

      <div v-if="documents.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        {{ EMPTY[type] }}
        <template v-if="type !== 'all'">Завести — кнопкой «Новая запись» выше или через Входящее.</template>
        <template v-else>Выберите тип на вкладке, чтобы завести запись.</template>
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="p-3 font-medium">Документ</th>
              <th v-if="type === 'all'" class="p-3 font-medium">Тип</th>
              <th class="p-3 font-medium">Статус</th>
              <th class="p-3 font-medium">Кто опирается</th>
              <th class="p-3 font-medium">Изменён</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="document in documents" :key="document.path">
              <td class="p-3">
                <RecordLink :project-id="projectId" :record-id="document.id" :record="document" />
              </td>
              <td v-if="type === 'all'" class="p-3 text-muted">{{ typeLabel(document.type) }}</td>
              <td class="p-3">
                <StatusBadge :status="document.status" />
                <!-- От устаревшего до действующего — один щелчок, а не поиск по номерам. -->
                <span v-if="document.backlinks.supersedes?.length" class="ml-2 text-xs text-muted">
                  заменён
                  <NuxtLink
                    v-for="id in document.backlinks.supersedes"
                    :key="id"
                    :to="`/projects/${projectId}/records/${id}`"
                    class="ml-1 font-mono hover:underline"
                  >{{ id }}</NuxtLink>
                </span>
              </td>
              <td class="p-3">
                <template v-if="reliedOnBy(document).length">
                  <NuxtLink
                    v-for="id in reliedOnBy(document)"
                    :key="id"
                    :to="`/projects/${projectId}/records/${id}`"
                    :title="byId.get(id)?.title"
                    class="mr-2 font-mono text-xs hover:underline"
                  >{{ id }}</NuxtLink>
                </template>
                <!-- Документ, который ничему не служит, — тот же висящий узел, что и в Графе. -->
                <span v-else class="text-muted">никто</span>
              </td>
              <td class="p-3 text-muted">{{ document.updated ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
