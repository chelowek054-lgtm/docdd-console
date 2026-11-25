<script setup lang="ts">
import type { MlStage, verificationRuns, researchHistory } from '~~/server/lib/industry-maps';
import type { FlowCapability, FlowRelation } from '~/utils/map-flow';

type Runs = ReturnType<typeof verificationRuns>;
type Decision = ReturnType<typeof researchHistory>[number] & { runs: Runs };
interface Stage { id: string; title: string; stage: MlStage; runs: Runs }
const props = defineProps<{ projectId: string }>();
const { t } = useT();
const { data, status, error } = useFetch<{ current: Stage[]; target: Stage[]; decisions: Decision[] }>(
  () => `/api/projects/${encodeURIComponent(props.projectId)}/maps/research`
);
const selected = ref('');
const decisions = computed(() => data.value?.decisions ?? []);
const decision = computed(() => decisions.value.find((item) => item.id === selected.value) ?? decisions.value[0]);
const items = computed(() => decisions.value.map((item) => ({ value: item.id, label: `${item.id} · ${item.title}` })));
const graph = computed(() => {
  const nodes: FlowCapability[] = [];
  const edges: FlowRelation[] = [];
  const item = decision.value;
  if (!item) return { nodes, edges };
  nodes.push({ id: 'hypothesis', kind: 'hypothesis', title: item.title });
  nodes.push({ id: item.id, kind: 'decision', title: item.title });
  for (const [index, run] of item.runs.entries()) {
    const experiment = `experiment-${index}`;
    nodes.push({ id: experiment, kind: 'experiment', title: `${run.id} · ${run.run}` });
    edges.push({ from: 'hypothesis', to: experiment, type: 'triggers' });
    if (run.measurements.length === 0) edges.push({ from: experiment, to: item.id, type: 'feeds' });
    for (const [metricIndex, metric] of run.measurements.entries()) {
      const id = `${experiment}-metric-${metricIndex}`;
      nodes.push({ id, kind: 'metric', title: `${metric.name} · ${metric.value} ${metric.unit}` });
      edges.push({ from: experiment, to: id, type: 'triggers' }, { from: id, to: item.id, type: 'feeds' });
    }
  }
  if (item.runs.length === 0) edges.push({ from: 'hypothesis', to: item.id, type: 'triggers' });
  const replacements = decisions.value.filter((branch) => item.supersedes.includes(branch.id) || branch.supersedes.includes(item.id));
  for (const branch of replacements) {
    nodes.push({ id: branch.id, kind: 'decision', title: `${branch.id} · ${branch.title}` });
    const outgoing = item.supersedes.includes(branch.id);
    edges.push({ from: outgoing ? item.id : branch.id, to: outgoing ? branch.id : item.id, type: 'replaces' });
  }
  return { nodes, edges };
});
</script>

<template>
  <p v-if="status === 'pending'" role="status" class="text-sm text-muted">{{ t('maps.research.loading') }}</p>
  <p v-else-if="error" role="alert" class="text-sm text-error">{{ t('maps.research.error') }}</p>
  <div v-else-if="data" class="space-y-6">
    <div class="grid gap-4 lg:grid-cols-2">
      <section v-for="side in (['current', 'target'] as const)" :key="side" class="space-y-3">
        <h2 class="font-semibold">{{ t(`maps.research.${side}`) }}</h2>
        <p v-if="!data[side].length" class="text-sm text-muted">{{ t('maps.research.noStages') }}</p>
        <article v-for="entry in data[side]" :key="entry.id" class="space-y-2 rounded-lg border border-default p-3">
          <h3 class="font-medium">{{ entry.title }}</h3>
          <p class="text-sm">{{ entry.stage.state }}</p>
          <dl class="text-sm">
            <template v-for="direction in (['inputs', 'outputs'] as const)" :key="direction">
              <dt class="font-medium">{{ t(`maps.research.${direction}`) }}</dt>
              <dd v-for="port in entry.stage[direction]" :key="port.name">{{ port.name }} · <code>{{ port.format }}</code></dd>
            </template>
          </dl>
          <ResearchRuns :runs="entry.runs" />
        </article>
      </section>
    </div>
    <section class="space-y-3">
      <h2 class="font-semibold">{{ t('maps.research.decisions') }}</h2>
      <p v-if="!decision" class="text-sm text-muted">{{ t('maps.research.noDecisions') }}</p>
      <template v-else>
        <USelect :model-value="decision.id" :items="items" :aria-label="t('maps.research.decisions')" class="w-full max-w-xl" @update:model-value="selected = $event" />
        <ClientOnly>
          <StandardMapGraph :key="decision.id" template="research" :view-id="decision.id" :nodes="graph.nodes" :edges="graph.edges" />
        </ClientOnly>
        <p class="text-sm">
          <NuxtLink :to="`/projects/${encodeURIComponent(projectId)}/records/${decision.id}`" class="text-primary hover:underline">{{ decision.id }}</NuxtLink>
          · {{ t(`maps.research.${decision.status}`) }}
        </p>
        <div v-for="field in (['context', 'options', 'outcome', 'reason'] as const)" :key="field">
          <template v-if="decision[field]">
            <h3 class="font-medium">{{ t(`maps.research.${field}`) }}</h3>
            <p class="whitespace-pre-wrap text-sm">{{ decision[field] }}</p>
          </template>
        </div>
        <ResearchRuns :runs="decision.runs" />
      </template>
    </section>
  </div>
</template>
