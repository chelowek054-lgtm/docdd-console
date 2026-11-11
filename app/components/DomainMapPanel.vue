<script setup lang="ts">
import type { ContextTree, ContextRelation, DomainState } from '~~/server/lib/domain-map';

/**
 * Доменная карта на экране «Стратегия» (R-0119, A-0004): вторая после стратегической.
 * Контекст со словарём и агрегатами раскрывается до слоёв, модулей и файлов —
 * их сервер берёт из кодовой карты по корню контекста. Компонент только показывает:
 * карту заводит запись `map` с блоком `docdd-domain`.
 */
const props = defineProps<{ projectId: string }>();
const { t } = useT();

interface DomainView { domain?: DomainState; domainTree?: ContextTree[] }
const { data, pending } = useFetch<DomainView>(() => `/api/projects/${props.projectId}/map?kind=domain`, {
  key: () => `domain-map:${props.projectId}`, server: false, lazy: true
});

const trees = computed(() => data.value?.domainTree ?? []);
const relations = computed<ContextRelation[]>(() => data.value?.domain?.relations ?? []);
const titleOf = computed(() => new Map(trees.value.map((item) => [item.context.id, item.context.title ?? item.context.id])));
const KIND_COLOR: Record<string, 'primary' | 'neutral' | 'info'> = { core: 'primary', supporting: 'info', generic: 'neutral' };
</script>

<template>
  <section class="space-y-3" :aria-label="t('dm.title')">
    <div class="flex flex-wrap items-baseline gap-2">
      <h2 class="text-lg font-semibold">{{ t('dm.title') }}</h2>
      <p class="text-sm text-muted">{{ t('dm.hint') }}</p>
    </div>

    <p v-if="pending && !data" class="text-sm text-muted">{{ t('st2.loading') }}</p>
    <div v-else-if="!trees.length" class="rounded-lg border border-dashed border-warning/50 p-6 text-sm">
      <p class="font-medium">{{ t('dm.empty') }}</p>
      <p class="mt-1 text-muted">{{ t('dm.emptyHint') }}</p>
    </div>

    <div v-else class="grid gap-3 lg:grid-cols-2">
      <UCard v-for="tree in trees" :key="tree.context.id" :ui="{ body: 'space-y-3' }">
        <div class="flex flex-wrap items-start gap-2">
          <UIcon name="i-lucide-boxes" class="mt-0.5 size-5 shrink-0 text-primary" />
          <div class="min-w-0 flex-1">
            <p class="font-medium">{{ tree.context.title ?? tree.context.id }}</p>
            <p v-if="tree.context.summary" class="text-xs text-muted">{{ tree.context.summary }}</p>
            <code v-if="tree.context.root" class="text-xs text-muted">{{ tree.context.root }}</code>
          </div>
          <UBadge v-if="tree.context.kind" :color="KIND_COLOR[tree.context.kind] ?? 'neutral'" variant="soft" size="sm">{{ t(`dm.kind.${tree.context.kind}`) }}</UBadge>
        </div>

        <div v-if="tree.context.capabilities?.length" class="flex flex-wrap gap-1">
          <UBadge v-for="cap in tree.context.capabilities" :key="cap" color="neutral" variant="outline" size="sm">{{ cap }}</UBadge>
        </div>

        <div v-if="tree.context.language?.length">
          <p class="text-xs font-medium text-muted">{{ t('dm.language') }}</p>
          <ul class="text-sm">
            <li v-for="term in tree.context.language" :key="term.term">
              <span class="font-medium">{{ term.term }}</span><span v-if="term.meaning" class="text-muted"> — {{ term.meaning }}</span>
              <code v-if="term.code" class="ml-1 text-xs">{{ term.code }}</code>
            </li>
          </ul>
        </div>

        <div v-for="aggregate in tree.aggregates" :key="aggregate.id" class="rounded-md border border-default p-2 text-sm">
          <p class="font-medium">{{ t('dm.aggregate') }}: {{ aggregate.title ?? aggregate.id }}<span v-if="aggregate.root" class="text-muted"> · {{ t('dm.root') }} <code>{{ aggregate.root }}</code></span></p>
          <ul v-if="aggregate.invariants?.length" class="mt-1 list-disc pl-5 text-xs">
            <li v-for="rule in aggregate.invariants" :key="rule">{{ rule }}</li>
          </ul>
          <p v-else class="mt-1 text-xs text-warning">{{ t('dm.noInvariants') }}</p>
          <p v-for="part in (['entities', 'valueObjects', 'policies', 'events'] as const)" v-show="aggregate[part]?.length" :key="part" class="mt-1 text-xs">
            <span class="text-muted">{{ t(`dm.${part}`) }}:</span> {{ (aggregate[part] ?? []).join(', ') }}
          </p>
        </div>

        <details v-if="tree.layers.length" class="text-sm">
          <summary class="cursor-pointer text-muted">{{ t('dm.code', { n: tree.files }) }}</summary>
          <ul class="mt-2 space-y-1">
            <li v-for="layer in tree.layers" :key="layer.layer">
              <details>
                <summary class="cursor-pointer">
                  <code :class="layer.clean ? '' : 'text-warning'">{{ layer.layer }}</code>
                  <span v-if="!layer.clean" class="text-xs text-warning"> · {{ t('dm.notLayer') }}</span>
                </summary>
                <ul class="ml-4 space-y-1">
                  <li v-for="module in layer.modules" :key="module.path">
                    <details>
                      <summary class="cursor-pointer text-xs">{{ module.id ?? t('dm.noModule') }} <code class="text-muted">{{ module.path }}</code></summary>
                      <ul class="ml-4 text-xs text-muted">
                        <li v-for="file in module.files" :key="file"><NuxtLink :to="`/projects/${projectId}/file?path=${encodeURIComponent(file)}`" class="hover:underline">{{ file }}</NuxtLink></li>
                      </ul>
                    </details>
                  </li>
                </ul>
              </details>
            </li>
          </ul>
        </details>
        <p v-else-if="tree.context.root" class="text-xs text-muted">{{ t('dm.noCode') }}</p>
      </UCard>
    </div>

    <div v-if="relations.length" class="text-sm">
      <p class="text-xs font-medium text-muted">{{ t('dm.relations') }}</p>
      <ul>
        <li v-for="relation in relations" :key="`${relation.from}>${relation.to}:${relation.kind}`">
          {{ titleOf.get(relation.from) ?? relation.from }} → {{ titleOf.get(relation.to) ?? relation.to }}
          <UBadge color="neutral" variant="outline" size="sm">{{ relation.kind }}</UBadge>
          <span v-if="relation.summary" class="text-muted"> {{ relation.summary }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>
