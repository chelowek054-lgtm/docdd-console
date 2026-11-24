<script setup lang="ts">
import { Controls } from '@vue-flow/controls';
import { Handle, MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import { standardFor } from '~~/server/lib/map-core';
import { flowGraph, layoutWithElk, type FlowCapability, type FlowNode, type FlowRelation } from '~/utils/map-flow';
import { mapScope } from '~/utils/map-scope';
import { MAP_SHAPES } from '~/utils/map-shapes';

const props = defineProps<{
  template: string;
  nodes: FlowCapability[];
  edges: FlowRelation[];
  projected?: boolean;
  viewId?: string;
  indicators?: Record<string, { children?: number; incoming?: number; outgoing?: number; muted?: boolean }>;
}>();
const emit = defineEmits<{
  select: [id: string];
  open: [id: string];
  relation: [from: string, to: string, kind?: string];
  clear: [];
}>();
const flowId = useId();
const { t } = useT();
const { fitView, setViewport } = useVueFlow(flowId);
const mode = useColorMode();
const standard = computed(() => standardFor(props.template)!.standard);
const shapes = computed(() => new Map(standard.value.nodeKinds.map((kind) => [kind.id, kind.shape])));
const route = useRoute();
const router = useRouter();
const groupKey = computed(() => 'group-' + props.template);
const open = computed(() => {
  const id = route.query[groupKey.value];
  return typeof id === 'string' && props.nodes.some((node) => node.id === id) ? id : undefined;
});
const depth = ref(1);
const storageKey = computed(() => JSON.stringify(['docdd-map-layout', route.params.id, props.viewId ?? props.template, open.value, depth.value]));
type NodePosition = FlowNode['position'];
type Viewport = NodePosition & { zoom: number };
function readLayout(): { positions?: Record<string, NodePosition>; viewport?: Viewport } {
  try {
    return JSON.parse(localStorage.getItem(storageKey.value) ?? '{}') ?? {};
  } catch {
    return {};
  }
}
function saveLayout(layout: ReturnType<typeof readLayout>) {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify(layout));
  } catch {
    // The current view still works without browser storage.
  }
}
function savePosition(node: { id: string; position: NodePosition }) {
  const layout = readLayout();
  saveLayout({ ...layout, positions: { ...layout.positions, [node.id]: node.position } });
}
function restoreViewport() {
  const viewport = readLayout().viewport;
  if (viewport) void setViewport(viewport);
  else void fitView({ padding: 0.2 });
}
const indicators = computed(() => props.projected ? props.indicators ?? {} : Object.fromEntries(scope.value.groups));
const scope = computed(() => mapScope(props.nodes, props.edges, open.value, depth.value));
const selectedNode = ref<string>();
const selectedEdge = ref<string>();
const detail = computed(() => props.nodes.find((node) => node.id === selectedNode.value));
const link = computed(() => scope.value.edges.find((edge) => JSON.stringify([edge.from, edge.to, edge.type]) === selectedEdge.value));
const titleOf = computed(() => new Map(props.nodes.map((node) => [node.id, node.title ?? node.id])));
function clearSelection() {
  selectedNode.value = undefined;
  selectedEdge.value = undefined;
}
function enter(id?: string) {
  clearSelection();
  void router.push({ query: { ...route.query, [groupKey.value]: id } });
}
function pickNode(id: string) {
  emit('select', id);
  if (props.projected) return;
  clearSelection();
  selectedNode.value = id;
}
function pickEdge(edge: { source: string; target: string; data?: { kind?: string } }) {
  if (props.projected) return emit('relation', edge.source, edge.target, edge.data?.kind);
  clearSelection();
  selectedEdge.value = JSON.stringify([edge.source, edge.target, edge.data?.kind]);
}
function openNode(id: string) {
  if (props.projected) emit('open', id);
  else if (scope.value.groups.has(id)) enter(id);
}
const graph = computed(() => flowGraph(
  props.projected ? props.nodes : scope.value.nodes,
  props.projected ? props.edges : scope.value.edges,
  standard.value, mode.value === 'dark' ? 'dark' : 'light'
));
const edges = computed(() => graph.value.edges.map((edge) => ({
  ...edge,
  ...(edge.markerEnd ? { markerEnd: { type: edge.markerEnd === 'arrow' ? MarkerType.Arrow : MarkerType.ArrowClosed } } : {}),
  ...(edge.markerStart ? { markerStart: { type: edge.markerStart === 'arrow' ? MarkerType.Arrow : MarkerType.ArrowClosed } } : {})
})));
const placed = shallowRef<FlowNode[]>([]);
const elk = new ELK();
const resetVersion = ref(0);
function resetLayout() {
  saveLayout({});
  ++resetVersion.value;
}

watch([graph, resetVersion], async ([value], _, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  const gap = Math.max(100, ...value.edges.map((edge) => Math.min(520, (edge.label?.length ?? 0) * 8 + 30)));
  const nodes = await layoutWithElk(elk, value.nodes, value.edges, gap);
  const positions = readLayout().positions;
  if (current) {
    placed.value = nodes.map((node) => ({ ...node, position: positions?.[node.id] ?? node.position }));
    await nextTick();
    if (current) restoreViewport();
  }
}, { immediate: true });
</script>

<template>
  <div>
    <MapNotation :template="template" />
    <nav v-if="!projected" class="mb-2 flex flex-wrap items-center gap-2" aria-label="Уровень карты">
      <UButton variant="link" @click="enter()">{{ t('mapGraph.overview') }}</UButton>
      <UButton v-for="item in scope.path" :key="item.id" variant="link" @click="enter(item.id)">{{ item.title ?? item.id }}</UButton>
      <label v-if="scope.groups.size" class="text-sm">{{ t('mapGraph.depth') }} <input v-model.number="depth" type="number" min="1" class="w-16 rounded border border-default px-1" @change="depth = Math.max(1, depth || 1)"></label>
    </nav>
    <div class="flex flex-wrap items-center gap-2">
      <UButton v-if="placed.length" size="xs" variant="ghost" @click="resetLayout">{{ t('mapGraph.reset') }}</UButton>
      <slot name="toolbar" />
    </div>
    <div class="relative h-[min(60vh,38rem)] min-h-64 overflow-hidden rounded-lg border border-default">
      <aside v-if="detail || link" class="absolute inset-y-0 right-0 z-20 w-full max-w-xs overflow-auto border-l border-default bg-default p-3" :aria-label="t('mapGraph.inspector')">
        <UButton class="float-right" icon="i-lucide-x" :aria-label="t('mapGraph.close')" variant="ghost" @click="clearSelection" />
        <template v-if="detail">
          <h3 class="font-semibold">{{ detail.title ?? detail.id }}</h3>
          <p class="mt-2 text-sm">{{ detail.summary || t('mapGraph.noSummary') }}</p>
          <UButton v-if="scope.groups.has(detail.id)" class="mt-2" @click="enter(detail.id)">{{ t('mapGraph.open') }}</UButton>
          <slot name="node-details" :node="detail" />
        </template>
        <ul v-else-if="link" class="space-y-2 pr-8 text-sm">
          <li v-for="(member, index) in link.members" :key="index">{{ titleOf.get(member.from) }} → {{ titleOf.get(member.to) }} · {{ member.summary || member.type }}</li>
        </ul>
      </aside>
      <VueFlow v-if="placed.length"
        :id="flowId" :nodes="placed" :edges="edges" :nodes-connectable="false" :nodes-draggable="true" :elements-selectable="false"
        @node-click="pickNode($event.node.id)" @edge-click="pickEdge($event.edge)"
        @node-double-click="openNode($event.node.id)" @pane-click="clearSelection(); emit('clear')"
        @node-drag-stop="savePosition($event.node)"
        :delete-key-code="null" :min-zoom="0.1" @nodes-initialized="restoreViewport"
        @viewport-change-end="saveLayout({ ...readLayout(), viewport: $event })"
      >
        <template #node-map="{ data, id }">
          <div class="relative flex h-[84px] w-[240px] flex-col justify-center px-7 text-left"
            role="button" tabindex="0" :aria-label="data.title"
            :class="{ 'pt-5': shapes.get(data.kind) === 'person', 'opacity-60': scope.outside.has(id) || props.indicators?.[id]?.muted }"
            @keydown.enter.stop.prevent="pickNode(id)" @keydown.space.stop.prevent="pickNode(id)">
            <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible">
              <path :d="MAP_SHAPES[shapes.get(data.kind) ?? 'rounded']" fill="var(--ui-bg)" :stroke="data.color" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <p class="flex items-center gap-1 text-xs" :style="{ color: data.color }">
              <UIcon :name="data.icon" /> {{ data.kindTitle }}
            </p>
            <p class="line-clamp-2 font-medium" :title="data.title">{{ data.title }}</p>
            <p v-if="indicators[id]?.children !== undefined" class="text-xs text-muted">{{ indicators[id]?.children }} · ↓{{ indicators[id]?.incoming ?? 0 }} ↑{{ indicators[id]?.outgoing ?? 0 }}</p>
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
