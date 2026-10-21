<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';

const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, byId, refresh, patchStatuses } = useProjectIndex(projectId); const backlinksOf = useBacklinks(projectId); const { t } = useT();

/**
 * Проектные документы, решения и контракты — один экран, а не три: вопрос к
 * ним один (подтверждено ли то, на что опирается работа), и схема статусов
 * одна (docs/04-ui.md, «Документы»).
 */
const TABS = computed(() => [
  { label: t('docs.tab.all'), value: 'all' },
  { label: t('docs.tab.requirement'), value: 'requirement' },
  { label: t('docs.tab.design'), value: 'design' },
  { label: t('docs.tab.decision'), value: 'decision' },
  { label: t('docs.tab.contract'), value: 'contract' },
  { label: t('docs.tab.reference'), value: 'reference' }
]);
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
  ? t('docs.title')
  : TABS.value.find((tab) => tab.value === type.value)?.label ?? t('docs.title')));

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
const chunk = useChunked(documents, 40);
const onBulkDone = (results?: BulkMoved[]) => { selection.clear(); if (results) patchStatuses(results); else void refresh(); };


/** Кто опирается: задачи, которые документ правят, и записи, что его уточняют или стоят на решении. */
function reliedOnBy(document: IndexRecord): string[] {
  return [...new Set([
    ...(backlinksOf(document).documents ?? []),
    ...(backlinksOf(document).refines ?? []),
    ...(backlinksOf(document).decided_by ?? [])
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
    ...(backlinksOf(requirement).verifies ?? [])
  ])];
}

function tasksOf(requirement: IndexRecord): string[] {
  return backlinksOf(requirement).implements ?? [];
}

/** Факт — результат прогонов; «подтверждён» в колонке статуса — другое (docs/04-ui.md). */
function outcome(requirement: IndexRecord) {
  return requirementFact(verificationsOf(requirement), results.value, requirement.status);
}

const EMPTY = computed<Record<string, string>>(() => ({
  all: t('docs.empty.all'),
  requirement: t('docs.empty.requirement'),
  reference: t('docs.empty.reference'),
  design: t('docs.empty.design'),
  decision: t('docs.empty.decision'),
  contract: t('docs.empty.contract')
}));
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">{{ heading }}</h1>
        <p class="text-sm text-muted">{{ documents.length }}<template v-if="status"> {{ t('docs.of') }} {{ listed.length }}</template></p>
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
        {{ t('docs.refHint') }} <NuxtLink :to="`/projects/${projectId}/reference`" class="hover:underline">{{ t('docs.refLink') }}</NuxtLink>.
      </p>

      <StatusTabs v-model="status" :statuses="statuses" :order="DOCUMENT_STATUS_ORDER" />

      <BulkBar
        :project-id="projectId"
        :selected="selection.selected.value"
        :total="documents.length"
        :roles="index?.project.roles ?? []"
        kind="document"
        @done="onBulkDone"
      />

      <div v-if="listed.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        {{ EMPTY[type] }}
        <template v-if="type !== 'all'">{{ t('docs.createHint') }}</template>
        <template v-else>{{ t('docs.pickType') }}</template>
      </div>

      <div v-else class="ds-card overflow-x-auto">
        <table class="ds-table w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="w-10 p-3">
                <UCheckbox
                  :model-value="selection.state.value"
                  :aria-label="t('docs.selectAll')"
                  @update:model-value="selection.toggleAll()"
                />
              </th>
              <th class="p-3 font-medium">{{ type === 'requirement' ? t('docs.col.requirement') : t('docs.col.document') }}</th>
              <th v-if="type === 'all'" class="p-3 font-medium">{{ t('docs.col.type') }}</th>
              <th class="p-3 font-medium">{{ t('docs.col.status') }}</th>
              <template v-if="type === 'requirement'">
                <th class="p-3 font-medium">{{ t('docs.col.tasks') }}</th>
                <th class="p-3 font-medium">{{ t('docs.col.checks') }}</th>
                <th class="p-3 font-medium">{{ t('docs.col.fact') }}</th>
              </template>
              <template v-else>
                <th class="p-3 font-medium">{{ t('docs.col.relies') }}</th>
                <th class="p-3 font-medium">{{ t('docs.col.changed') }}</th>
              </template>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="document in chunk.visible.value" :key="document.path">
              <td class="p-3">
                <UCheckbox
                  :model-value="selection.has(document.id)"
                  :aria-label="`${t('docs.mark')} ${document.id}`"
                  @update:model-value="selection.set(document.id, $event)"
                />
              </td>
              <td class="p-3">
                <RecordLink :project-id="projectId" :record-id="document.id" :record="document" />
              </td>
              <td v-if="type === 'all'" class="p-3 text-muted">{{ typeLabel(document.type) }}</td>
              <td class="p-3">
                <StatusBadge :status="document.status" /><DiffUnviewed :project-id="projectId" :record-id="document.id" :status="document.status" />
                <!-- От устаревшего до действующего — один щелчок, а не поиск по номерам. -->
                <span v-if="backlinksOf(document).supersedes?.length" class="ml-2 text-xs text-muted">
                  {{ t('docs.replaced') }}
                  <NuxtLink
                    v-for="id in backlinksOf(document).supersedes"
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
                  <span v-else class="text-muted">{{ t('docs.noneTasks') }}</span>
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
                  <span v-else class="text-muted">{{ t('docs.noChecks') }}</span>
                </td>
                <td class="p-3">
                  <LightBadge :color="outcome(document).color" variant="subtle">{{ outcome(document).label }}</LightBadge>
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
                <span v-else class="text-muted">{{ t('docs.nobody') }}</span>
              </td>
              <td class="p-3 text-muted">{{ document.updated ?? '—' }}</td>
              </template>
            </tr>
          </tbody>
        </table>
        <div v-if="chunk.rest.value > 0" class="border-t border-default p-3 text-center">
          <UButton variant="ghost" color="neutral" @click="chunk.more()">{{ t('docs.more') }} {{ Math.min(chunk.step, chunk.rest.value) }}</UButton>
        </div>
      </div>
    </template>
  </div>
</template>
