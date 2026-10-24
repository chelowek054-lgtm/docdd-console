<script setup lang="ts">
/**
 * Просмотр файла документации проекта — сюда ведёт смысловой поиск по README и
 * docs/** (docs/adr/0031-semantic-search.md). Только чтение, только внутри корня.
 */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const path = computed(() => String(route.query['path'] ?? ''));
const { t } = useT();

const { data, error } = useFetch<{ path: string; content: string }>(() => `/api/projects/${projectId.value}/file`, {
  query: computed(() => ({ path: path.value })),
  key: () => `file:${projectId.value}:${path.value}`
});
const isMarkdown = computed(() => path.value.toLowerCase().endsWith('.md'));
</script>

<template>
  <div class="space-y-4">
    <div>
      <p class="font-mono text-sm text-muted">{{ path }}</p>
    </div>
    <UAlert v-if="error" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="t('file.notRead')" />
    <UCard v-else-if="data">
      <DocumentText v-if="isMarkdown" :body="data.content" />
      <pre v-else class="overflow-x-auto text-sm whitespace-pre-wrap">{{ data.content }}</pre>
    </UCard>
  </div>
</template>
