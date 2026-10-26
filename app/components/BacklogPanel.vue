<script setup lang="ts">
import type { CapabilityLike } from '~~/server/lib/functional';
import type { BulkMoved } from '~/composables/useProjectIndex';
// Вкладка «Бэклог» экрана «Работа» (docs/04-ui.md, R-0105): отложенное на будущее и рекомендации с горизонтом «Потом».
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { t } = useT();
const { index, failure, records, refresh, patchStatuses } = useProjectIndex(projectId);

const deferred = computed(() => records.value
  .filter((record) => record.status === 'deferred' && (record.type === 'requirement' || record.type === 'task'))
  .sort((a, b) => a.type.localeCompare(b.type) || a.id.localeCompare(b.id)));
const selection = useSelection(deferred);
const onDone = (results?: BulkMoved[]) => { selection.clear(); if (results) patchStatuses(results); else void refresh(); };
const actor = computed(() => index.value?.project.roles[0]?.id ?? '');

/** Рекомендации на будущее: возможности стратегической карты с горизонтом «Потом», ещё не сделанные. */
const { data: map } = useFetch<{ functional?: { capabilities: CapabilityLike[] } }>(() => `/api/projects/${projectId.value}/map`, { query: { kind: 'functional' }, server: false, lazy: true });
const later = computed(() => (map.value?.functional?.capabilities ?? []).filter((item) => item.horizon === 'later' && item.status !== 'implemented'));
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />
    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">{{ t('nav.backlog') }}</h2>
        <p class="text-sm text-muted">{{ deferred.length }}</p>
      </div>
      <p class="text-sm text-muted">{{ t('bl.hint') }}</p>

      <div class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated/40 px-3 py-2">
        <p class="text-sm">{{ t('bulk.selected') }} <span class="font-medium">{{ selection.selected.value.length }}</span> {{ t('bulk.of') }} {{ deferred.length }}</p>
        <DeferBulk direction="return" :project-id="projectId" :selected="selection.selected.value" :actor="actor" @done="onDone" />
      </div>

      <div v-if="deferred.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">{{ t('bl.empty') }}</div>
      <div v-else class="rounded-lg border border-default">
        <div class="border-b border-default px-4 py-2">
          <UCheckbox :model-value="selection.state.value" :label="t('tp.selectAll')" @update:model-value="selection.toggleAll()" />
        </div>
        <ul class="divide-y divide-default">
          <li v-for="record in deferred" :key="record.id" class="flex flex-wrap items-center gap-3 p-3">
            <UCheckbox :model-value="selection.has(record.id)" :aria-label="record.id" @update:model-value="selection.set(record.id, $event)" />
            <UBadge color="neutral" variant="subtle" size="sm">{{ typeLabel(record.type) }}</UBadge>
            <RecordLink :project-id="projectId" :record-id="record.id" :record="record" />
            <LightBadge v-if="record.phase" color="neutral" variant="subtle">{{ record.phase }}</LightBadge>
          </li>
        </ul>
      </div>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center gap-3">
            <h3 class="font-medium">{{ t('bl.later') }}</h3>
            <NuxtLink :to="`/projects/${projectId}/strategy`" class="ml-auto text-sm text-muted hover:underline">{{ t('bl.toStrategy') }}</NuxtLink>
          </div>
        </template>
        <p v-if="later.length === 0" class="text-sm text-muted">{{ t('bl.noLater') }}</p>
        <ul v-else class="space-y-1 text-sm">
          <li v-for="item in later" :key="item.id"><span class="font-mono text-xs text-muted">{{ item.id }}</span> {{ item.title ?? item.id }}</li>
        </ul>
      </UCard>
    </template>
  </div>
</template>
