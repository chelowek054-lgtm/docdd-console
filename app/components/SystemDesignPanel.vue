<script setup lang="ts">
import type { Difference, SystemDesign } from '~~/server/lib/system-design';

const props = defineProps<{ projectId: string }>();
const { t } = useT();
const { data, pending, error } = useFetch<{ sysdesign: SystemDesign }>(
  () => `/api/projects/${props.projectId}/map?kind=sysdesign`,
  { server: false }
);
const { data: report, status, error: compareError, execute } = useFetch<{ differences: Difference[] }>(
  () => `/api/projects/${props.projectId}/map/compare-design`,
  { immediate: false, server: false, watch: false }
);
const design = computed(() => data.value?.sysdesign);
const edges = computed(() => design.value?.relations.map((edge) => ({
  from: edge.from, to: edge.to, type: edge.kind, summary: edge.label
})) ?? []);
</script>

<template>
  <section class="space-y-4">
    <h2 class="text-lg font-semibold">System Design</h2>
    <p v-if="error" role="alert">{{ error.message }}</p>
    <p v-else-if="pending">{{ t('st2.loading') }}</p>
    <template v-else-if="design">
      <p v-if="!design.nodes.length">{{ t('maps.sysdesign.empty') }}</p>
      <template v-else>
        <LazyStandardMapGraph template="sysdesign" :nodes="design.nodes" :edges="edges" />
        <details v-for="node in design.nodes" :key="node.id" class="rounded border border-default p-2">
          <summary>{{ node.title }}</summary>
          <dl class="mt-2 grid gap-1 text-sm">
            <template v-for="field in (['reference', 'inputs', 'outputs', 'formats', 'hot_path', 'algorithm', 'language', 'runtime', 'realized_by'] as const)" :key="field">
              <div v-if="node[field]?.length"><dt class="inline font-medium">{{ t('sd.' + field) }} · </dt><dd class="inline">{{ Array.isArray(node[field]) ? (node[field] as string[]).join(', ') : node[field] }}</dd></div>
            </template>
            <div v-if="node.load">{{ t('sd.load') }} · {{ node.load.value }} {{ node.load.unit }}</div>
            <div v-if="node.decisions?.length">
              {{ t('sd.decisions') }} ·
              <NuxtLink v-for="id in node.decisions" :key="id" class="mr-2 underline" :to="`/projects/${projectId}/records/${id}`">{{ id }}</NuxtLink>
            </div>
          </dl>
        </details>
        <UButton :loading="status === 'pending'" @click="execute()">{{ t('sd.compare') }}</UButton>
        <p v-if="compareError" role="alert">{{ compareError.message }}</p>
        <div v-else-if="report" aria-live="polite">
          <p v-if="!report.differences.length">{{ t('sd.clean') }}</p>
          <ul v-else class="list-disc pl-5">
            <li v-for="difference in report.differences" :key="JSON.stringify(difference)">
              {{ t('sd.' + difference.code) }} · {{ difference.location }} · {{ difference.detail }}
            </li>
          </ul>
        </div>
      </template>
      <details v-if="design.standards.length">
        <summary>{{ t('sd.standards') }}</summary>
        <p v-for="standard in design.standards" :key="standard.id">{{ standard.language }} · {{ standard.configs.join(', ') }} <span v-if="standard.coverage_min !== undefined">· ≥ {{ standard.coverage_min }}%</span></p>
      </details>
    </template>
  </section>
</template>
