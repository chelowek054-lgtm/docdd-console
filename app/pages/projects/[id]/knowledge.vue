<script setup lang="ts">
import type { KnowledgeNode } from '~~/server/lib/knowledge';
import { breadcrumbs } from '~~/server/lib/knowledge';

/**
 * Пространство знаний (T-0039): дерево документов как страницы. Пункт меню →
 * документ в дереве → правка на месте: два клика. Текст правит BodyEditor
 * (docs/adr/0011-body-editing.md), подтверждённое он не пускает.
 */
const route = useRoute(); const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { data } = useFetch<{ tree: KnowledgeNode[] }>(() => `/api/projects/${projectId.value}/knowledge`, { key: () => `knowledge:${projectId.value}`, default: () => ({ tree: [] }) });
const tree = computed(() => data.value.tree);
const selected = ref('');
// Дерево заметок вложенное (T-0048): в меню оно разворачивается в строки с отступом.
const flat = (nodes: KnowledgeNode[], depth = 0): { node: KnowledgeNode; depth: number }[] => nodes.flatMap((node) => [{ node, depth }, ...flat(node.children, depth + 1)]);
const crumbs = computed(() => breadcrumbs(tree.value, selected.value));
const current = computed(() => crumbs.value[1] ?? null);
const { index } = useProjectIndex(projectId);
const { detail, refresh } = useRecord(projectId, computed(() => (current.value?.kind === 'record' ? current.value.recordId ?? '' : '')));
</script>

<template>
  <div class="grid gap-4 lg:grid-cols-4">
    <nav class="space-y-3 lg:col-span-1">
      <div v-for="group in tree" :key="group.key">
        <h2 class="text-xs font-semibold uppercase text-muted">{{ group.title }}</h2>
        <ul class="mt-1 space-y-0.5 text-sm">
          <li v-for="{ node: page, depth } in flat(group.children)" :key="page.key" :style="{ paddingLeft: `${depth * 12}px` }">
            <button class="w-full truncate text-left hover:underline" :class="{ 'font-semibold': selected === page.key }" @click="selected = page.key">{{ page.title }}</button>
          </li>
        </ul>
      </div>
      <p v-if="tree.length === 0" class="text-sm text-muted">{{ t('kn.none') }}</p>
    </nav>
    <section class="lg:col-span-3">
      <p v-if="!current" class="text-sm text-muted">{{ t('kn.pick') }}</p>
      <template v-else>
        <p class="mb-2 text-xs text-muted">{{ crumbs.map((c) => c.title).join(' / ') }}</p>
        <template v-if="current.kind === 'record' && detail && detail.record.id === current.recordId">
          <h1 class="mb-2 text-xl font-semibold">{{ detail.record.title }}</h1>
          <BodyEditor :project-id="projectId" :record-id="detail.record.id" :body="detail.body" :status="detail.record.status" :roles="index?.project.roles ?? []" @changed="refresh" />
        </template>
        <p v-else-if="current.kind === 'note'" class="font-mono text-xs">{{ current.key }}</p>
      </template>
    </section>
  </div>
</template>
