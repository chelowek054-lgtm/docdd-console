<script setup lang="ts">
const props = defineProps<{ projectId: string; map: string }>();
const { t } = useT();
const open = ref(false);
interface AgentContext {
  question?: string;
  instructions: string;
  schema?: unknown;
  standard?: unknown;
  page?: { totals: Record<string, number> };
  sources?: unknown;
}
const { data, error, pending, refresh } = useFetch<AgentContext>(
  () => `/api/projects/${encodeURIComponent(props.projectId)}/map/context`, {
    query: computed(() => ({ map: props.map, limit: 1 })),
    immediate: false,
    watch: false
  }
);
function toggle(event: Event) {
  open.value = (event.currentTarget as HTMLDetailsElement).open;
  if (open.value) void refresh();
}
watch(() => [props.projectId, props.map], () => { if (open.value) void refresh(); });
</script>

<template>
  <details class="rounded border border-default p-2 text-sm" @toggle="toggle">
    <summary class="cursor-pointer font-medium">{{ t('maps.agentInstructions') }}</summary>
    <p v-if="pending" role="status" class="mt-2 text-muted">{{ t('maps.agentLoading') }}</p>
    <p v-else-if="error" role="status" class="mt-2 text-warning">{{ t('maps.agentError') }}</p>
    <template v-else-if="data">
      <p v-if="data.question" class="mt-2 font-medium">{{ data.question }}</p>
      <div class="mt-2 max-h-80 overflow-auto whitespace-pre-wrap">{{ data.instructions }}</div>
      <p v-if="data.page" class="mt-2 text-xs text-muted">
        {{ t('maps.agentCurrent') }} · {{ Object.entries(data.page.totals).map(([key, value]) => key + ' ' + value).join(' · ') }}
      </p>
      <details v-if="data.standard" class="mt-2">
        <summary class="cursor-pointer">{{ t('maps.agentLegend') }}</summary>
        <pre class="max-h-64 overflow-auto text-xs">{{ JSON.stringify(data.standard, null, 2) }}</pre>
      </details>
      <details v-if="data.schema" class="mt-2">
        <summary class="cursor-pointer">{{ t('maps.agentSchema') }}</summary>
        <pre class="max-h-64 overflow-auto text-xs">{{ JSON.stringify(data.schema, null, 2) }}</pre>
      </details>
      <details v-if="data.sources" class="mt-2">
        <summary class="cursor-pointer">{{ t('maps.agentSources') }}</summary>
        <pre class="max-h-64 overflow-auto text-xs">{{ JSON.stringify(data.sources, null, 2) }}</pre>
      </details>
    </template>
  </details>
</template>
