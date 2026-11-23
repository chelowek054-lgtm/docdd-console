<script setup lang="ts">
import { Controls } from '@vue-flow/controls';
import { Handle, MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import { standardFor } from '~~/server/lib/map-core';
import { flowGraph, layoutWithElk, type FlowCapability, type FlowNode, type FlowRelation } from '~/utils/map-flow';
import { MAP_SHAPES } from '~/utils/map-shapes';

const props = defineProps<{ template: string; nodes: FlowCapability[]; edges: FlowRelation[] }>();
const flowId = useId();
const { fitView } = useVueFlow(flowId);
const mode = useColorMode();
const standard = computed(() => standardFor(props.template)!.standard);
const shapes = computed(() => new Map(standard.value.nodeKinds.map((kind) => [kind.id, kind.shape])));
const graph = computed(() => flowGraph(props.nodes, props.edges, standard.value, mode.value === 'dark' ? 'dark' : 'light'));
const edges = computed(() => graph.value.edges.map((edge) => ({
  ...edge,
  ...(edge.markerEnd ? { markerEnd: { type: edge.markerEnd === 'arrow' ? MarkerType.Arrow : MarkerType.ArrowClosed } } : {}),
  ...(edge.markerStart ? { markerStart: { type: edge.markerStart === 'arrow' ? MarkerType.Arrow : MarkerType.ArrowClosed } } : {})
})));
const placed = shallowRef<FlowNode[]>([]);
const elk = new ELK();

watch(graph, async (value, _, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  const gap = Math.max(100, ...value.edges.map((edge) => Math.min(520, (edge.label?.length ?? 0) * 8 + 30)));
  const nodes = await layoutWithElk(elk, value.nodes, value.edges, gap);
  if (current) placed.value = nodes;
}, { immediate: true });
</script>

<template>
  <div>
    <MapNotation :template="template" />
    <div class="h-[min(60vh,38rem)] min-h-64 overflow-hidden rounded-lg border border-default">
      <VueFlow v-if="placed.length"
        :id="flowId" :nodes="placed" :edges="edges" :nodes-connectable="false" :nodes-draggable="false"
        :delete-key-code="null" :min-zoom="0.1" fit-view-on-init @nodes-initialized="fitView({ padding: 0.2 })"
      >
        <template #node-map="{ data }">
          <div class="relative flex h-[84px] w-[240px] flex-col justify-center px-7 text-left" :class="{ 'pt-5': shapes.get(data.kind) === 'person' }">
            <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible">
              <path :d="MAP_SHAPES[shapes.get(data.kind) ?? 'rounded']" fill="var(--ui-bg)" :stroke="data.color" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <p class="flex items-center gap-1 text-xs" :style="{ color: data.color }">
              <UIcon :name="data.icon" /> {{ data.kindTitle }}
            </p>
            <p class="line-clamp-2 font-medium" :title="data.title">{{ data.title }}</p>
            <Handle id="in" type="target" :position="Position.Left" />
            <Handle id="out" type="source" :position="Position.Right" />
          </div>
        </template>
        <Controls :show-interactive="false" />
      </VueFlow>
    </div>
  </div>
</template>

<style scoped>
:deep(.vue-flow__edge-textbg) { fill: var(--ui-bg); }
:deep(.vue-flow__edge-text) { fill: var(--ui-text); }
</style>
