<script setup lang="ts">
import { Controls } from '@vue-flow/controls';
import { Handle, MarkerType, Position, VueFlow, useVueFlow } from '@vue-flow/core';
import ELK from 'elkjs/lib/elk.bundled.js';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

import { isolatedMapNodes, standardFor } from '~~/server/lib/map-core';
import { flowNode, layoutWithElk, type FlowCapability, type FlowNode, type FlowRelation } from '~/utils/map-flow';
import { compactMapFrame, filterMapRelations, frameCollision, frameEndpoint, frameMembers, mapFrames, mapLinePorts, mapLinkAppearance, mapSvg, relationLevel, simpleMapLines, spaceMapGroups } from '~/utils/map-presentation';
import { mapScope } from '~/utils/map-scope';
import { MAP_SHAPES } from '~/utils/map-shapes';
import { restoreMapPositions, type MapPositions } from '~/utils/map-layout-restore';

const props = defineProps<{
  template: string;
  nodes: FlowCapability[];
  edges: FlowRelation[];
  projected?: boolean;
  viewId?: string;
  mapId?: string;
  frameTitle?: string;
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
const fullscreenRoot = ref<HTMLElement>();
const fullscreen = ref(false);
function updateFullscreen() {
  if (!document.fullscreenElement) setExpanded(false);
}
function setExpanded(expanded: boolean) {
  fullscreen.value = expanded;
  void nextTick(() => document.dispatchEvent(new Event('docdd-map-expanded')));
}
function toggleFullscreen() {
  const root = fullscreenRoot.value;
  if (!root) return;
  if (fullscreen.value) {
    setExpanded(false);
    if (document.fullscreenElement === root) void document.exitFullscreen().catch(() => {});
  } else {
    setExpanded(true);
    void root.requestFullscreen?.().then(() => {
      if (!fullscreen.value && document.fullscreenElement === root) return document.exitFullscreen();
    }).catch(() => {});
  }
}
function exitOnEscape(event: KeyboardEvent) {
  if (event.key === 'Escape' && fullscreen.value && !document.fullscreenElement) setExpanded(false);
}
onMounted(() => {
  document.addEventListener('fullscreenchange', updateFullscreen);
  document.addEventListener('keydown', exitOnEscape);
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', updateFullscreen);
  document.removeEventListener('keydown', exitOnEscape);
  if (fullscreen.value) setExpanded(false);
});
const { fitView, setViewport, viewport: flowViewport } = useVueFlow(flowId);
defineExpose({
  editorViewport: () => ({ ...flowViewport.value }),
  editorPositions: () => Object.fromEntries(placed.value.map(({ id, position }) => [id, position]))
});
const mode = useColorMode();
const standard = computed(() => standardFor(props.template)!.standard);
const mapTitle = computed(() => props.template === 'domain' || props.template === 'sysdesign'
  ? t('maps.v.' + props.template) : standard.value.title);
const shapes = computed(() => new Map(standard.value.nodeKinds.map((kind) => [kind.id, kind.shape])));
const route = useRoute();
const router = useRouter();
const groupKey = computed(() => 'group-' + props.template);
const open = computed(() => {
  const id = route.query[groupKey.value];
  return typeof id === 'string' && props.nodes.some((node) => node.id === id) ? id : undefined;
});
const depth = ref(1);
const legacyStorageKey = computed(() => JSON.stringify(['docdd-map-layout', route.params.id, props.viewId ?? props.template, open.value, scope.value.level]));
const projectId = computed(() => String(route.params.id ?? ''));
const logicalMap = computed(() => props.mapId ?? props.template);
const viewKey = computed(() => JSON.stringify(props.projected
  ? [props.viewId, route.query.group, route.query.capgroup, route.query.fgroup, route.query.cgroup,
    route.query.depth, route.query.cdepth, route.query.open, route.query.copen]
  : [props.viewId, open.value, scope.value.level]));
const storageKey = computed(() => props.projected ? JSON.stringify([legacyStorageKey.value, viewKey.value]) : legacyStorageKey.value);
const renderedStorageKey = ref('');
type NodePosition = FlowNode['position'];
type Viewport = NodePosition & { zoom: number };
const { state: shared, pending: sharedPending, publishing, issue: presentationIssue, load, publish } =
  useSharedMapLayout(projectId, logicalMap);
const sharedPositions = computed(() => shared.value?.views[viewKey.value]);
function readLayout(): { positions?: MapPositions; viewport?: Viewport; exact?: boolean; automatic?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(storageKey.value) ?? localStorage.getItem(legacyStorageKey.value) ?? '{}') ?? {};
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
  const previous = placed.value;
  const next = previous.map((item) => item.id === node.id ? { ...item, position: node.position } : item);
  storePositions(frameCollision(frameNodes.value, next, externalNodes.value) ? [...previous] : next);
}
function restoreViewport() {
  const viewport = readLayout().viewport;
  if (viewport) void setViewport(viewport);
  else void fitView({ padding: 0.2, minZoom: 0.32 });
}
const indicators = computed(() => props.projected ? props.indicators ?? {} : Object.fromEntries(scope.value.groups));
const scope = computed(() => mapScope(props.nodes, props.edges, open.value, depth.value));
const trail = computed(() => scope.value.path.map((node) => ({ id: node.id, title: node.title ?? node.id })));
const orphanCount = computed(() => props.projected ? 0 : isolatedMapNodes(props.nodes, props.edges).size);
const selectedNode = ref<string>();
const selectedEdge = ref<string>();
const detail = computed(() => props.nodes.find((node) => node.id === selectedNode.value));
const link = computed(() => lines.value.find((edge) => edge.id === selectedEdge.value));
const titleOf = computed(() => new Map(props.nodes.map((node) => [node.id, node.title ?? node.id])));
function clearSelection() {
  selectedNode.value = undefined;
  selectedEdge.value = undefined;
}
watch([open, () => scope.value.level, () => props.viewId, () => route.query.depth, () => route.query.cdepth,
  () => route.query.cgroup], () => {
  clearSelection();
  if (props.projected) emit('clear');
});
function enter(id?: string) {
  clearSelection();
  depth.value = 1;
  void router.push({ query: { ...route.query, [groupKey.value]: id } });
}
function pickNode(id: string) {
  emit('select', id);
  if (props.projected) return;
  clearSelection();
  selectedNode.value = id;
}
function pickEdge(edge: { id: string }) {
  const line = lines.value.find((item) => item.id === edge.id);
  if (props.projected && line?.members.length === 1) {
    const member = line.members[0]!;
    return emit('relation', member.from, member.to, member.type);
  }
  clearSelection();
  selectedEdge.value = edge.id;
}
function openNode(id: string) {
  if (props.projected) emit('open', id);
  else if (scope.value.groups.has(id)) enter(id);
}
const visibleNodes = computed(() => props.projected ? props.nodes : scope.value.nodes);
const relations = computed(() => props.projected
  ? props.edges.map((edge) => ({ ...edge, members: [edge] }))
  : scope.value.edges);
const hiddenLevels = ref<number[]>([]);
const hiddenTypes = ref<string[]>([]);
const projectedDepth = computed(() => {
  const depth = String(route.query.depth ?? route.query.cdepth ?? '');
  return Number(depth) || (props.frameTitle ? 2 : 1);
});
const linkLevel = (edge: FlowRelation) => props.projected
  ? (props.indicators?.[edge.from]?.children && props.indicators?.[edge.to]?.children ? 1 : projectedDepth.value)
  : relationLevel(edge, scope.value.nodeDepths);
const linkType = (edge: FlowRelation) => edge.filterType ?? edge.type;
const bidirectional = (edge: FlowRelation) =>
  edge.filterType === 'both' || Boolean(standard.value.edgeKinds.find((kind) => kind.id === edge.type)?.twoWay);
const lineLevels = computed(() => [...new Set(props.edges.map(linkLevel))].sort((a, b) => a - b));
const lineTypes = computed(() => [...new Set(props.edges.map(linkType))]);
function lineTypeTitle(type: string) {
  if (props.projected) return t('mapGraph.projectedLink.' + type);
  return standard.value.edgeKinds.find((kind) => kind.id === type)?.title ?? type;
}
function toggleFilter<T extends string | number>(hidden: T[], value: T, shown: boolean) {
  return shown ? hidden.filter((item) => item !== value) : [...hidden, value];
}
const fullLines = computed(() => simpleMapLines(
  relations.value, bidirectional,
  (edge) => edge.members.length
));
const lines = computed(() => simpleMapLines(
  filterMapRelations(relations.value, (member) =>
    !hiddenLevels.value.includes(linkLevel(member)) && !hiddenTypes.value.includes(linkType(member))),
  bidirectional,
  (edge) => edge.members.reduce((count, member) => count + (member.count ?? 1), 0),
  (edge) => Math.min(...edge.members.map(linkLevel))
));
const graph = computed(() => {
  const ids = new Set(visibleNodes.value.map((node) => node.id));
  return {
    nodes: visibleNodes.value.map((node) => flowNode(node, standard.value, mode.value === 'dark' ? 'dark' : 'light')),
    edges: fullLines.value.filter((line) => ids.has(line.from) && ids.has(line.to))
      .map((line) => ({ id: line.id, source: line.from, target: line.to }))
  };
});
const placed = shallowRef<FlowNode[]>([]);
const frameNodes = computed(() => {
  if (!props.frameTitle) return props.nodes.map((node) => {
    if (node.id !== open.value) return node;
    const root = { ...node };
    delete root.parent;
    return root;
  });
  const frameId = '__open-group-frame';
  return [{ id: frameId, title: props.frameTitle }, ...props.nodes.map((node) => ({ ...node, parent: frameId }))];
});
const externalNodes = computed(() => props.frameTitle
  ? new Set(Object.keys(props.indicators ?? {}).filter((id) => props.indicators?.[id]?.muted))
  : scope.value.outside);
const frames = computed(() => mapFrames(frameNodes.value, placed.value, externalNodes.value)
  .sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top)));
let drag: {
  pointer: number; start: NodePosition; original: FlowNode[]; members: Set<string>; moved: boolean;
} | undefined;
let suppressFrameClick = false;

function storePositions(nodes: FlowNode[]) {
  placed.value = nodes;
  saveLayout({ ...readLayout(), exact: true, positions: Object.fromEntries(nodes.map((node) => [node.id, node.position])) });
}
async function publishLayout() {
  const key = storageKey.value;
  if (renderedStorageKey.value !== key || drag) return;
  const snapshot = placed.value;
  const positions = Object.fromEntries(snapshot.map(({ id, position }) => [id, position]));
  saveLayout({ ...readLayout(), positions, exact: true });
  if (await publish(viewKey.value, positions) &&
      storageKey.value === key && placed.value === snapshot) {
    const { viewport } = readLayout();
    saveLayout(viewport ? { viewport } : {});
  }
}
function compactFrame(id: string) {
  const nodes = compactMapFrame(frameNodes.value, placed.value, externalNodes.value, fullLines.value, id);
  if (nodes !== placed.value) storePositions(nodes);
}
function startFrameDrag(event: PointerEvent, id: string) {
  if (event.button !== 0 || drag) return;
  suppressFrameClick = false;
  drag = {
    pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, original: placed.value,
    members: frameMembers(frameNodes.value, id, externalNodes.value), moved: false
  };
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
}
function moveFrameDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointer) return;
  const { start, original, members } = drag;
  const dx = event.clientX - start.x, dy = event.clientY - start.y;
  if (!drag.moved && Math.hypot(dx, dy) < 4) return;
  drag.moved = true;
  const zoom = flowViewport.value.zoom;
  placed.value = original.map((node) => members.has(node.id) ? {
    ...node, position: { x: node.position.x + dx / zoom, y: node.position.y + dy / zoom }
  } : node);
}
function endFrameDrag(event: PointerEvent) {
  if (!drag || event.pointerId !== drag.pointer) return;
  const { original, moved } = drag;
  drag = undefined;
  suppressFrameClick = moved;
  if (!moved) return;
  if (event.type !== 'pointerup' || frameCollision(frameNodes.value, placed.value, externalNodes.value)) placed.value = original;
  else storePositions(placed.value);
}
const canvasNodes = computed(() => [
  ...placed.value,
  ...frames.value.map((frame) => {
    const bounds = frameEndpoint(frame);
    return { ...bounds, type: 'frame', draggable: false, style: { pointerEvents: 'none' } };
  })
]);
const arrange = (nodes: FlowNode[], balanceOverview: boolean) =>
  spaceMapGroups(frameNodes.value, nodes, externalNodes.value, fullLines.value, balanceOverview);
const edges = computed(() => {
  const nodes = new Map(canvasNodes.value.map((node) => [node.id, node]));
  return lines.value.flatMap((line) => {
    const a = nodes.get(line.from), b = nodes.get(line.to);
    if (!a || !b) return [];
    const { sourceHandle, targetHandle } = mapLinePorts(a, b);
    const { width, opacity } = mapLinkAppearance(line.level, false);
    const stroke = `color-mix(in srgb, var(--ui-text) ${opacity * 100}%, transparent)`;
    const marker = { type: MarkerType.ArrowClosed, color: stroke, width: 8, height: 8, markerUnits: 'userSpaceOnUse' as const };
    return [{
      id: line.id, source: line.from, target: line.to, sourceHandle, targetHandle, type: 'straight',
      markerEnd: marker, ...(line.twoWay ? { markerStart: marker } : {}),
      style: { stroke, strokeWidth: width },
      ...(line.count > 1 ? { label: String(line.count) } : {})
    }];
  });
});
function downloadSvg() {
  const blob = new Blob([mapSvg(placed.value, lines.value, frames.value, standard.value, mode.value === 'dark')], { type: 'image/svg+xml' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `map-${props.template}.svg`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
const elk = new ELK();
const resetVersion = ref(0);
function resetLayout() {
  saveLayout({ automatic: true });
  ++resetVersion.value;
}

watch([graph, resetVersion, storageKey, sharedPositions], async ([value], _, onCleanup) => {
  let current = true;
  onCleanup(() => { current = false; });
  const nodes = await layoutWithElk(elk, value.nodes, value.edges, 90);
  const { positions, exact, automatic } = readLayout();
  if (current) {
    drag = undefined;
    const saved = positions ?? (automatic ? undefined : sharedPositions.value);
    if (saved && (exact || !positions)) {
      placed.value = restoreMapPositions(arrange(nodes, true), saved, frameNodes.value, externalNodes.value);
    } else {
      const preferred = nodes.map((node) => ({ ...node, position: positions?.[node.id] ?? node.position }));
      placed.value = arrange(preferred, !positions);
    }
    renderedStorageKey.value = storageKey.value;
    await nextTick();
    if (current) restoreViewport();
  }
}, { immediate: true });
</script>

<template>
  <div ref="fullscreenRoot" data-map-fullscreen :data-map-expanded="fullscreen ? '' : undefined"
    :class="fullscreen ? 'fixed inset-0 z-[60] flex flex-col bg-default p-3' : undefined">
    <MapNotation :template="template" />
    <div v-if="projected" data-map-depth-target><slot name="navigation" /></div>
    <MapGraphNavigation v-else :title="mapTitle" :trail="trail" :max-depth="scope.maxDepth" :depth="scope.level"
      @enter="enter" @update:depth="depth = $event" />
    <div class="relative z-10 mb-3 flex flex-wrap items-center gap-2">
      <UButton v-if="placed.length" size="xs" variant="ghost" @click="resetLayout">{{ t('mapGraph.reset') }}</UButton>
      <UButton v-if="placed.length" size="xs" variant="ghost" @click="fitView({ padding: 0.2 })">{{ t('mapGraph.fit') }}</UButton>
      <UPopover v-if="lineTypes.length" :portal="false">
        <UButton size="xs" variant="ghost" icon="i-lucide-list-filter">{{ t('mapGraph.links') }}</UButton>
        <template #content>
          <div class="grid max-h-72 min-w-44 gap-3 overflow-auto p-3">
            <fieldset class="space-y-1">
              <legend class="mb-1 text-xs font-medium text-muted">{{ t('mapGraph.linkLevels') }}</legend>
              <UCheckbox v-for="level in lineLevels" :key="level" :model-value="!hiddenLevels.includes(level)"
                :label="t('mapGraph.currentLevel', { n: level })" size="xs"
                @update:model-value="hiddenLevels = toggleFilter(hiddenLevels, level, $event === true)" />
            </fieldset>
            <fieldset class="space-y-1">
              <legend class="mb-1 text-xs font-medium text-muted">{{ t('mapGraph.linkTypes') }}</legend>
              <UCheckbox v-for="type in lineTypes" :key="type" :model-value="!hiddenTypes.includes(type)"
                :label="lineTypeTitle(type)" size="xs"
                @update:model-value="hiddenTypes = toggleFilter(hiddenTypes, type, $event === true)" />
            </fieldset>
          </div>
        </template>
      </UPopover>
      <UButton v-if="placed.length" size="xs" variant="ghost" icon="i-lucide-download" @click="downloadSvg">{{ t('mapGraph.svg') }}</UButton>
      <UButton v-if="placed.length" size="xs" variant="ghost" :icon="fullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
        :aria-pressed="fullscreen" @click="toggleFullscreen">{{ t(fullscreen ? 't83.m2.fs.exit' : 't83.m2.fs.enter') }}</UButton>
      <span v-if="orphanCount" class="text-xs text-warning">{{ t('mapGraph.orphans', { n: orphanCount }) }}</span>
      <UPopover v-if="projectId" :portal="false">
        <UButton size="xs" variant="ghost" icon="i-lucide-history">{{ t('mapGraph.history') }}</UButton>
        <template #content>
          <div class="w-72 space-y-2 p-3">
            <UButton v-if="shared?.canPublish" size="xs" :loading="publishing"
              :disabled="sharedPending || !placed.length || renderedStorageKey !== storageKey" @click="publishLayout">{{ t('mapGraph.publishLayout') }}</UButton>
            <p v-if="presentationIssue" role="status" class="text-xs text-warning">{{ t('mapGraph.presentation.' + presentationIssue) }}</p>
            <UButton v-if="presentationIssue === 'load'" size="xs" variant="ghost" @click="load">{{ t('mapGraph.retryHistory') }}</UButton>
            <p v-else-if="shared && !shared.history.length" class="text-xs text-muted">{{ t('mapGraph.historyEmpty') }}</p>
            <ol v-else class="max-h-64 space-y-2 overflow-auto text-sm">
              <li v-for="(entry, index) in shared?.history" :key="index" class="border-b border-default pb-1">
                <span>{{ t('mapGraph.history.' + entry.kind) }} · {{ entry.accountId }}<template v-if="entry.recordId"> · {{ entry.recordId }}</template></span>
                <time :datetime="entry.at" class="block text-xs text-muted">{{ new Date(entry.at).toLocaleString() }}</time>
              </li>
            </ol>
          </div>
        </template>
      </UPopover>
      <slot name="toolbar" />
    </div>
    <div class="relative isolate overflow-hidden rounded-lg border border-default"
      :class="fullscreen ? 'min-h-0 flex-1' : ['aspect-video min-h-64 w-full max-h-[75vh]', !projected && '2xl:pr-80']">
      <aside v-if="detail || link" class="absolute inset-y-0 right-0 z-20 w-full max-w-xs overflow-auto border-l border-default bg-default p-3" :aria-label="t('mapGraph.inspector')">
        <UButton class="float-right" icon="i-lucide-x" :aria-label="t('mapGraph.close')" variant="ghost" @click="clearSelection" />
        <template v-if="detail">
          <h3 class="font-semibold">{{ detail.title ?? detail.id }}</h3>
          <p class="mt-2 text-sm">{{ detail.summary || t('mapGraph.noSummary') }}</p>
          <UButton v-if="scope.groups.has(detail.id) && detail.id !== open" class="mt-2" @click="enter(detail.id)">{{ t('mapGraph.open') }}</UButton>
          <slot name="node-details" :node="detail" />
        </template>
        <ul v-else-if="link" class="space-y-2 pr-8 text-sm">
          <li v-for="(member, index) in link.members.flatMap((item) => item.members)" :key="index">{{ titleOf.get(member.from) ?? member.from }} → {{ titleOf.get(member.to) ?? member.to }} · {{ member.summary || member.type }}</li>
        </ul>
      </aside>
      <VueFlow v-if="placed.length"
        :id="flowId" :nodes="canvasNodes" :edges="edges" :nodes-connectable="false" :nodes-draggable="true" :elements-selectable="false"
        @node-click="pickNode($event.node.id)" @edge-click="pickEdge($event.edge)"
        @node-double-click="openNode($event.node.id)" @pane-click="clearSelection(); emit('clear')"
        @node-drag-stop="savePosition($event.node)"
        :delete-key-code="null" :min-zoom="0.1" @nodes-initialized="restoreViewport"
        @viewport-change-end="saveLayout({ ...readLayout(), viewport: $event })"
      >
        <template #zoom-pane>
          <div v-for="frame in frames" :key="frame.id" class="nodrag nopan pointer-events-auto absolute -z-10 cursor-grab touch-none overflow-hidden rounded-lg border border-primary/50 px-2 text-xs text-primary active:cursor-grabbing"
            @pointerdown.stop="startFrameDrag($event, frame.id)" @pointermove="moveFrameDrag"
            @pointerup.stop="endFrameDrag" @pointercancel="endFrameDrag" @lostpointercapture="endFrameDrag"
            :style="{ left: frame.left + 'px', top: frame.top + 'px', width: (frame.right - frame.left) + 'px', height: (frame.bottom - frame.top) + 'px' }">
            <div class="flex items-center justify-between gap-1">
              <button v-if="!projected" type="button" class="min-w-0 truncate text-left"
                :title="frame.title" @click.stop="(!suppressFrameClick || $event.detail === 0) && pickNode(frame.id)"
                @dblclick.stop="!suppressFrameClick && openNode(frame.id)">{{ frame.title }}</button>
              <div v-else class="truncate" :title="frame.title">{{ frame.title }}</div>
              <button type="button" class="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded hover:bg-primary/15"
                :title="t('mapGraph.compactGroup')" :aria-label="t('mapGraph.compactGroup')"
                @pointerdown.stop @dblclick.stop @click.stop="compactFrame(frame.id)">
                <UIcon name="i-lucide-minimize-2" class="size-3" />
              </button>
            </div>
          </div>
        </template>
        <template #node-frame>
          <Handle id="in" type="target" :position="Position.Left" class="opacity-0" />
          <Handle id="out" type="source" :position="Position.Right" class="opacity-0" />
          <Handle id="out-left" type="source" :position="Position.Left" class="opacity-0" />
          <Handle id="in-right" type="target" :position="Position.Right" class="opacity-0" />
        </template>
        <template #node-map="{ data, id }">
          <div class="relative flex h-[84px] w-[240px] flex-col justify-center px-7 text-left"
            role="button" tabindex="0" :aria-label="data.title"
            :class="{ 'pt-5': shapes.get(data.kind) === 'person', 'opacity-60': scope.outside.has(id) || props.indicators?.[id]?.muted }"
            @keydown.enter.stop.prevent="pickNode(id)" @keydown.space.stop.prevent="pickNode(id)">
            <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible">
              <path :d="MAP_SHAPES[shapes.get(data.kind) ?? 'rounded']" fill="var(--ui-bg)" :stroke="data.color" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <p class="flex items-center gap-1 text-xs" :style="{ color: data.color }">
              <UIcon :name="data.icon" /> {{ indicators[id]?.children ? t('mapGraph.groupKind') : data.kindTitle }}
            </p>
            <p class="line-clamp-2 font-medium" :title="data.title">{{ data.title }}</p>
            <p v-if="indicators[id]?.children !== undefined" class="text-xs text-muted">{{ indicators[id]?.children }} · ↓{{ indicators[id]?.incoming ?? 0 }} ↑{{ indicators[id]?.outgoing ?? 0 }}</p>
            <Handle id="in" type="target" :position="Position.Left" />
            <Handle id="out" type="source" :position="Position.Right" />
            <Handle id="out-left" type="source" :position="Position.Left" />
            <Handle id="in-right" type="target" :position="Position.Right" />
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
