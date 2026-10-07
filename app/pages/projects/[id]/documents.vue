<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, byId, refresh } = useProjectIndex(projectId);

/**
 * Проектные документы, решения и контракты — один экран, а не три: вопрос к
 * ним один (подтверждено ли то, на что опирается работа), и схема статусов
 * одна (docs/04-ui.md, «Документы»).
 */
const TABS = [
  { label: 'Все', value: 'all' },
  { label: 'Требования', value: 'requirement' },
  { label: 'Проектные документы', value: 'design' },
  { label: 'Решения', value: 'decision' },
  { label: 'Контракты', value: 'contract' },
  { label: 'Справки', value: 'reference' }
];
const DOCUMENT_TYPES = ['requirement', 'design', 'decision', 'contract', 'reference'];

/** Вкладка живёт в адресе: пункт шапки ведёт сразу на свою, а не на выбор. */
const type = computed({
  get: () => {
    const value = route.query['type'];
    return typeof value === 'string' && DOCUMENT_TYPES.includes(value) ? value : 'all';
  },
  set: (value: string | number) => {
    const next = String(value);
    // Статус живёт рядом с типом и переживает смену вкладки типа, если он там есть.
    const { type: _dropped, ...rest } = route.query;
    router.replace({ query: next === 'all' ? rest : { ...rest, type: next } });
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

const listed = computed(() => records.value
  .filter((record) => (type.value === 'all' ? DOCUMENT_TYPES.includes(record.type) : record.type === type.value))
  .sort((a, b) => rank(a.status) - rank(b.status) || a.id.localeCompare(b.id)));

/** Вторая ось после типа: статус (docs/04-ui.md, «Списки по статусам»). */
const statuses = computed(() => listed.value.map((record) => record.status));
const status = useStatusFilter(statuses);
const documents = computed(() => (status.value ? listed.value.filter((record) => record.status === status.value) : listed.value));

const selection = useSelection(documents);

/** Кто опирается: задачи, которые документ правят, и записи, что его уточняют или стоят на решении. */
function reliedOnBy(document: IndexRecord): string[] {
  return [...new Set([
    ...(document.backlinks.documents ?? []),
    ...(document.backlinks.refines ?? []),
    ...(document.backlinks.decided_by ?? [])
  ])].sort();
}

/**
 * Вкладка «Требования»: вместо «Кто опирается» и «Изменён» — таблица покрытия
 * (docs/04-ui.md, «Требования»): задачи, проверки и факт — результат прогонов.
 * Строка без проверки видна сразу — это главный дефект, который вкладка ищет.
 */
const results = computed(() => index.value?.verificationResults ?? {});

function verificationsOf(requirement: IndexRecord): string[] {
  return [...new Set([
    ...(requirement.links.verified_by ?? []),
    ...(requirement.backlinks.verifies ?? [])
  ])];
}

function tasksOf(requirement: IndexRecord): string[] {
  return requirement.backlinks.implements ?? [];
}

/** Факт — результат прогонов; «подтверждён» в колонке статуса — другое (docs/04-ui.md). */
function outcome(requirement: IndexRecord) {
  return requirementFact(verificationsOf(requirement), results.value, requirement.status);
}

const EMPTY: Record<string, string> = {
  all: 'Требований, проектных документов, решений, контрактов и справок в проекте нет.',
  requirement: 'Требований в проекте нет.',
  reference: 'Справок в проекте нет.',
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
        <p class="text-sm text-muted">{{ documents.length }}<template v-if="status"> из {{ listed.length }}</template></p>
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
      <p v-if="type === 'reference'" class="text-sm text-muted">
        Индекс и устаревшие справки — на экране <NuxtLink :to="`/projects/${projectId}/reference`" class="hover:underline">«Справочник»</NuxtLink>.
      </p>

      <StatusTabs v-model="status" :statuses="statuses" :order="DOCUMENT_STATUS_ORDER" />

      <BulkBar
        :project-id="projectId"
        :selected="selection.selected.value"
        :total="documents.length"
        :roles="index?.project.roles ?? []"
        kind="document"
        @done="selection.clear(); refresh()"
      />

      <div v-if="listed.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        {{ EMPTY[type] }}
        <template v-if="type !== 'all'">Завести — кнопкой «Новая запись» выше или через Входящее.</template>
        <template v-else>Выберите тип на вкладке, чтобы завести запись.</template>
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="w-10 p-3">
                <UCheckbox
                  :model-value="selection.state.value"
                  aria-label="Выбрать всё"
                  @update:model-value="selection.toggleAll()"
                />
              </th>
              <th class="p-3 font-medium">{{ type === 'requirement' ? 'Требование' : 'Документ' }}</th>
              <th v-if="type === 'all'" class="p-3 font-medium">Тип</th>
              <th class="p-3 font-medium">Статус</th>
              <template v-if="type === 'requirement'">
                <th class="p-3 font-medium">Задачи</th>
                <th class="p-3 font-medium">Проверки</th>
                <th class="p-3 font-medium">Факт</th>
              </template>
              <template v-else>
                <th class="p-3 font-medium">Кто опирается</th>
                <th class="p-3 font-medium">Изменён</th>
              </template>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="document in documents" :key="document.path">
              <td class="p-3">
                <UCheckbox
                  :model-value="selection.has(document.id)"
                  :aria-label="`Отметить ${document.id}`"
                  @update:model-value="selection.set(document.id, $event)"
                />
              </td>
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
              <template v-if="type === 'requirement'">
                <td class="p-3">
                  <template v-if="tasksOf(document).length">
                    <NuxtLink
                      v-for="id in tasksOf(document)"
                      :key="id"
                      :to="`/projects/${projectId}/records/${id}`"
                      class="mr-2 font-mono text-xs hover:underline"
                    >{{ id }}</NuxtLink>
                  </template>
                  <span v-else class="text-muted">ни одной</span>
                </td>
                <td class="p-3">
                  <template v-if="verificationsOf(document).length">
                    <NuxtLink
                      v-for="id in verificationsOf(document)"
                      :key="id"
                      :to="`/projects/${projectId}/records/${id}`"
                      class="mr-2 font-mono text-xs hover:underline"
                    >{{ id }}</NuxtLink>
                  </template>
                  <span v-else class="text-muted">нет</span>
                </td>
                <td class="p-3">
                  <UBadge :color="outcome(document).color" variant="subtle" size="sm">{{ outcome(document).label }}</UBadge>
                </td>
              </template>
              <template v-else>
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
              </template>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
