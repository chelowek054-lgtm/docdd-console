<script setup lang="ts">
import type { BulkMoved } from '~/composables/useProjectIndex';
import { FACTS, NO_ASSIGNEE, byAssignee, factCounts, factOf, kindOf, uncoveredRequirements, type Fact } from '~~/server/lib/verify-desk';
// Вкладка «Проверки» экрана «Сверка»: проверки, результат, нарушения и граф на одном экране (docs/04-ui.md, «Навигация»).
const route = useRoute(); const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, records, refresh, patchStatuses } = useProjectIndex(projectId); const backlinksOf = useBacklinks(projectId);

const listed = computed(() => records.value.filter((record) => record.type === 'verification'));
const statuses = computed(() => listed.value.map((record) => record.status));
const status = useStatusFilter(statuses);
const results = computed(() => index.value?.verificationResults ?? {});

/** Факт и вид — то, по чему тестировщик ищет работу (docs/04-ui.md, «Сверка — рабочее место тестировщика»). */
const fact = ref<Fact | ''>('');
const ALL_KINDS = 'all';
const kind = ref(ALL_KINDS);
const kindItems = computed(() => [
  { label: t('vd.allKinds'), value: ALL_KINDS },
  ...[...new Set(listed.value.map(kindOf).filter(Boolean))].sort().map((value) => ({ label: value, value }))
]);
/** «Мои» и «Без исполнителя» (R-0097): пусто — все. */
const who = ref('');
const { me } = useMe(() => projectId.value);
const myLogin = computed(() => me.value?.user?.login ?? '');
const byKind = computed(() => byAssignee(kind.value === ALL_KINDS ? listed.value : listed.value.filter((record) => kindOf(record) === kind.value), who.value));
const counts = computed(() => factCounts(byKind.value, results.value));
const FACT_COLOR: Record<Fact, 'error' | 'warning' | 'neutral' | 'success'> = { failed: 'error', blocked: 'warning', awaiting: 'warning', never: 'neutral', passed: 'success' };
const uncovered = computed(() => uncoveredRequirements(records.value));
const showUncovered = ref(false);

const checks = computed(() => byKind.value.filter((record) =>
  (!status.value || record.status === status.value)
  && (!fact.value || factOf(record, results.value[record.id]?.state) === fact.value)));
const selection = useSelection(checks);
// Порциями: сотни проверок разом тормозят отрисовку.
const chunk = useChunked(checks);
// Статус обновляем строкой из ответа, а не перечитыванием всего индекса (R-0041).
const onBulkDone = (results?: BulkMoved[]) => { selection.clear(); if (results) patchStatuses(results); else void refresh(); };

/** Что проверяет: связь ставится в обе стороны, показываем как одно множество. */
function verifiesOf(check: (typeof checks.value)[number]): string[] {
  return [...new Set([...(check.links.verifies ?? []), ...(backlinksOf(check).verified_by ?? [])])];
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">{{ t('cp.title') }}</h2>
        <p class="text-sm text-muted">{{ checks.length }}<template v-if="status"> {{ t('cp.of') }} {{ listed.length }}</template></p>
        <NewRecord class="ml-auto" :project-id="projectId" type="verification" :records="records" @created="refresh" />
      </div>

      <!-- Факты — они же фильтр: что сломано, что ждёт рук, что ещё не гоняли. -->
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          size="sm"
          :variant="fact === '' ? 'solid' : 'soft'"
          color="neutral"
          @click="fact = ''"
        >{{ t('vd.all') }} · {{ byKind.length }}</UButton>
        <UButton
          v-for="item in FACTS"
          :key="item"
          size="sm"
          :variant="fact === item ? 'solid' : 'soft'"
          :color="FACT_COLOR[item]"
          :disabled="counts[item] === 0 && fact !== item"
          @click="fact = fact === item ? '' : item"
        >{{ t(`vd.fact.${item}`) }} · {{ counts[item] }}</UButton>
        <UButton v-if="myLogin" size="sm" :variant="who === myLogin ? 'solid' : 'soft'" color="neutral" icon="i-lucide-user" @click="who = who === myLogin ? '' : myLogin">{{ t('mb.mine') }}</UButton>
        <UButton size="sm" :variant="who === NO_ASSIGNEE ? 'solid' : 'soft'" color="neutral" icon="i-lucide-user-plus" @click="who = who === NO_ASSIGNEE ? '' : NO_ASSIGNEE">{{ t('mb.noAssignee') }}</UButton>
        <USelect v-model="kind" :items="kindItems" size="sm" class="ml-auto w-44" :aria-label="t('vd.kind')" />
      </div>

      <!-- Пробелы покрытия: тестировщик закрывает их первыми. -->
      <UCard v-if="uncovered.length" :ui="{ body: 'p-3 sm:p-3' }">
        <div class="flex flex-wrap items-center gap-2">
          <UIcon name="i-lucide-shield-alert" class="size-5 text-warning" />
          <p class="min-w-0 flex-1 text-sm"><span class="font-medium">{{ t('vd.uncovered', { n: uncovered.length }) }}</span> <span class="text-muted">{{ t('vd.uncoveredHint') }}</span></p>
          <UButton size="xs" variant="ghost" color="neutral" :trailing-icon="showUncovered ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" @click="showUncovered = !showUncovered">
            {{ showUncovered ? t('rel.hide') : t('rel.show') }}
          </UButton>
        </div>
        <ul v-if="showUncovered" class="mt-2 space-y-1 text-sm">
          <li v-for="requirement in uncovered" :key="requirement.id"><RecordLink :project-id="projectId" :record-id="requirement.id" :record="requirement" /></li>
        </ul>
      </UCard>

      <StatusTabs v-model="status" :statuses="statuses" :order="DOCUMENT_STATUS_ORDER" />

      <BulkBar
        :project-id="projectId"
        :selected="selection.selected.value"
        :total="checks.length"
        :roles="index?.project.roles ?? []"
        kind="document"
        @done="onBulkDone"
      />

      <div v-if="listed.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">
        {{ t('cp.none') }}
      </div>

      <div v-else class="ds-card overflow-x-auto">
        <table class="ds-table w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="w-10 p-3">
                <UCheckbox
                  :model-value="selection.state.value"
                  :aria-label="t('tp.selectAll')"
                  @update:model-value="selection.toggleAll()"
                />
              </th>
              <th class="p-3 font-medium">{{ t('cp.colCheck') }}</th>
              <th class="p-3 font-medium">{{ t('cp.colDecision') }}</th>
              <th class="p-3 font-medium">{{ t('cp.colWhat') }}</th>
              <th class="p-3 font-medium">{{ t('cp.colFact') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="check in chunk.visible.value" :key="check.path">
              <td class="p-3">
                <UCheckbox
                  :model-value="selection.has(check.id)"
                  :aria-label="t('tp.mark', { id: check.id })"
                  @update:model-value="selection.set(check.id, $event)"
                />
              </td>
              <td class="p-3">
                <RecordLink :project-id="projectId" :record-id="check.id" :record="check" />
              </td>
              <td class="p-3">
                <StatusBadge :status="check.status" />
              </td>
              <td class="p-3">
                <template v-if="verifiesOf(check).length">
                  <NuxtLink
                    v-for="id in verifiesOf(check)"
                    :key="id"
                    :to="`/projects/${projectId}/records/${id}`"
                    class="mr-2 font-mono text-xs hover:underline"
                  >{{ id }}</NuxtLink>
                </template>
                <span v-else class="text-muted">{{ t('cp.nothing') }}</span>
              </td>
              <td class="p-3">
                <LightBadge
                  v-if="results[check.id]"
                  :color="statusColor(results[check.id]!.state)"
                  variant="subtle"
                 
                >{{ resultLabel(results[check.id]!.state) }} · {{ results[check.id]!.at.slice(0, 10) }}</LightBadge>
                <LightBadge v-else color="neutral" variant="subtle">{{ t('tp.neverRan') }}</LightBadge>
                <!-- Результат засчитывается как есть, но под ним — неподтверждённый способ. -->
                <LightBadge
                  v-if="checkNote(check.status, !!results[check.id])"
                  color="warning"
                  variant="subtle"
                 
                  class="ml-1"
                >{{ checkNote(check.status, !!results[check.id]) }}</LightBadge>
                <!-- Ручную проверку некому прогнать, кроме человека (docs/04-ui.md). -->
                <VerifiedCheck
                  class="mt-1"
                  compact
                  :project-id="projectId"
                  :record="check"
                  :result="results[check.id]"
                  :roles="index?.project.roles ?? []"
                  @changed="refresh"
                />
              </td>
            </tr>
          </tbody>
        </table>
        <div v-if="chunk.rest.value > 0" class="border-t border-default p-3 text-center">
          <UButton variant="ghost" color="neutral" @click="chunk.more()">{{ t('tp.more') }} {{ Math.min(chunk.step, chunk.rest.value) }}</UButton>
        </div>
      </div>
    </template>
  </div>
</template>
