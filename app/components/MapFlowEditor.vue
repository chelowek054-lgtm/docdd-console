<script setup lang="ts">
import { Controls } from '@vue-flow/controls';
import { Handle, Position, VueFlow, useVueFlow, type Connection } from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';
import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

import { standardFor } from '~~/server/lib/map-core';
import {
  flowEdge, flowGraph, layoutWithElk, suggestId,
  type FlowCapability, type FlowEdge, type FlowNode, type FlowRelation
} from '~/utils/map-flow';
import { visualMapDraft, type EditableMapTemplate } from '~/utils/visual-map-draft';
import { MAP_SHAPES } from '~/utils/map-shapes';

/**
 * Редактор стратегической карты мышью (R-0144, A-0010 п. 8). Холст — Vue Flow, раскладка — elkjs.
 * Правки копятся на холсте и уходят одним черновиком записи карты через тот же линтер, что у
 * остальных путей; подтверждает черновик человек в «Записях карт». Положение узлов не хранится.
 */
const props = withDefaults(defineProps<{
  projectId: string;
  capabilities: readonly FlowCapability[];
  relations: readonly FlowRelation[];
  template?: EditableMapTemplate;
  scope?: string;
  initialViewport?: { x: number; y: number; zoom: number };
  initialPositions?: Record<string, { x: number; y: number }>;
}>(), { template: 'strategic', scope: '' });
const emit = defineEmits<{ saved: [id: string] }>();
const { t } = useT();
const colorMode = useColorMode();
const theme = computed<'light' | 'dark'>(() => (colorMode.value === 'dark' ? 'dark' : 'light'));
const standard = standardFor(props.template)?.standard ?? null;
const { allowed } = useMe(() => props.projectId);
const nodeKinds = (standard?.nodeKinds ?? []).map((kind) => ({ label: kind.title, value: kind.id }));
const shapes = new Map(standard?.nodeKinds.map((kind) => [kind.id, kind.shape]));

const FLOW_ID = useId();
const { fitView, setViewport, screenToFlowCoordinate, getSelectedNodes, getSelectedEdges } = useVueFlow(FLOW_ID);

const freshNodes = ref<FlowCapability[]>([]);
const freshEdges = ref<FlowRelation[]>([]);
/** Правки стоящих узлов (узел целиком: запись карты объявляет его заново) и удаления (R-0147). */
const editedNodes = ref<FlowCapability[]>([]);
const removedNodes = ref<string[]>([]);
const removedEdges = ref<FlowRelation[]>([]);
const edgeKey = (edge: FlowRelation) => `${edge.from}>${edge.to}:${edge.type}`;
/** Картина на холсте: подтверждённое с правками и удалениями плюс новое. */
const shownCapabilities = computed(() => {
  const gone = new Set(removedNodes.value);
  const edits = new Map(editedNodes.value.map((node) => [node.id, node]));
  return [...props.capabilities.filter((node) => !gone.has(node.id)).map((node) => edits.get(node.id) ?? node), ...freshNodes.value];
});
const shownRelations = computed(() => {
  const gone = new Set(removedNodes.value);
  const cut = new Set(removedEdges.value.map(edgeKey));
  return props.relations.filter((edge) => !cut.has(edgeKey(edge)) && !gone.has(edge.from) && !gone.has(edge.to));
});
function insideScope(node: FlowCapability) {
  if (!props.scope) return true;
  const parents = new Map(shownCapabilities.value.map((item) => [item.id, item.parent]));
  const seen = new Set<string>();
  for (let at: string | undefined = node.id; at && !seen.has(at); at = parents.get(at)) {
    if (at === props.scope) return true;
    seen.add(at);
  }
  return false;
}
const nodes = ref<FlowNode[]>([]);
const edges = ref<FlowEdge[]>([]);
const fullscreen = ref(false);
/** Перетащенные узлы держат место до новой раскладки: иначе обновление карты сбрасывало бы их. */
const moved = new Map(Object.entries(props.initialPositions ?? {}));

let elk: { layout(graph: unknown): Promise<{ children?: { id: string; x?: number; y?: number }[] }> } | null = null;
let layoutRevision = 0;
async function elkInstance() {
  if (!elk) {
    const module = await import('elkjs/lib/elk.bundled.js');
    const ELK = (module as unknown as { default: new () => typeof elk }).default;
    elk = new ELK();
  }
  return elk as NonNullable<typeof elk>;
}

async function rebuild(relayout: boolean) {
  if (!standard) return;
  const revision = ++layoutRevision;
  const graph = flowGraph(shownCapabilities.value.filter(insideScope), shownRelations.value, standard, theme.value);
  const fresh = new Set([...freshNodes.value, ...editedNodes.value].map((node) => node.id));
  const graphNodes = graph.nodes.map((node) => (fresh.has(node.id) ? { ...node, data: { ...node.data, fresh: true } } : node));
  const ids = new Set(graphNodes.map((node) => node.id));
  const graphEdges = [...graph.edges, ...freshEdges.value.filter((edge) => ids.has(edge.from) && ids.has(edge.to)).map((edge) => flowEdge(edge, standard, true))];
  if (relayout) moved.clear();
  const placed = await layoutWithElk(await elkInstance(), graphNodes, graphEdges);
  if (revision !== layoutRevision) return;
  nodes.value = placed.map((node) => ({ ...node, position: moved.get(node.id) ?? node.position }));
  edges.value = graphEdges;
  if (relayout) await nextTick(() => fitView({ padding: 0.15 }));
}

onMounted(async () => {
  await rebuild(!props.initialViewport);
  if (props.initialViewport) await setViewport(props.initialViewport);
});
watch(() => [props.capabilities, props.relations, props.scope, theme.value], () => { void rebuild(false); });

function onNodeDragStop(event: { node: { id: string; position: { x: number; y: number } } }) {
  moved.set(event.node.id, { ...event.node.position });
}

// Меню по правой кнопке: «Добавить узел» с поиском по видам стандарта.
const menu = ref<{ x: number; y: number; at: { x: number; y: number } } | null>(null);
const menuQuery = ref('');
const shell = ref<HTMLElement | null>(null);
const kinds = computed(() => {
  const query = menuQuery.value.trim().toLowerCase();
  return (standard?.nodeKinds ?? []).filter((kind) => !query || kind.title.toLowerCase().includes(query) || kind.id.includes(query));
});
function onPaneMenu(event: MouseEvent) {
  event.preventDefault();
  const box = shell.value?.getBoundingClientRect();
  menu.value = { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0), at: screenToFlowCoordinate({ x: event.clientX, y: event.clientY }) };
  menuQuery.value = '';
}

const taken = computed(() => new Set([...props.capabilities, ...freshNodes.value].map((item) => item.id)));
// Пустое значение пункт выбора не принимает — «без родителя» назван отдельным значением.
const NO_PARENT = '-';
const nodeForm = reactive({ open: false, mode: 'add' as 'add' | 'edit', kind: '', id: '', title: '', summary: '', parent: NO_PARENT, idTouched: false, at: { x: 0, y: 0 } });
function pickKind(kind: string) {
  if (!menu.value) return;
  Object.assign(nodeForm, { open: true, mode: 'add', kind, id: '', title: '', summary: '', parent: props.scope || NO_PARENT, idTouched: false, at: menu.value.at });
  menu.value = null;
}
watch(() => [nodeForm.title, nodeForm.parent], () => {
  if (nodeForm.mode === 'add' && !nodeForm.idTouched && nodeForm.title) nodeForm.id = suggestId(nodeForm.title, taken.value, nodeForm.parent === NO_PARENT ? undefined : nodeForm.parent);
});
function canBeParent(candidate: FlowCapability) {
  const byId = new Map(shownCapabilities.value.map((node) => [node.id, node]));
  const seen = new Set<string>();
  for (let at: FlowCapability | undefined = candidate; at && !seen.has(at.id); at = at.parent ? byId.get(at.parent) : undefined) {
    if (at.id === nodeForm.id) return false;
    seen.add(at.id);
  }
  return true;
}
const parentItems = computed(() => [{ label: t('maps.editor.noParent'), value: NO_PARENT },
  ...shownCapabilities.value.filter(canBeParent).map((item) => ({ label: `${item.title ?? item.id} (${item.id})`, value: item.id }))]);
const nodeProblem = computed(() => {
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(nodeForm.id)) return t('maps.editor.badId');
  if (nodeForm.mode === 'add' && taken.value.has(nodeForm.id)) return t('maps.editor.takenId');
  if (!nodeForm.title.trim() || !nodeForm.summary.trim()) return t('maps.editor.needFields');
  return '';
});
function openEdit(id: string) {
  const node = shownCapabilities.value.find((item) => item.id === id);
  if (!node || !standard) return;
  Object.assign(nodeForm, {
    open: true, mode: 'edit', kind: node.kind ?? standard.defaultNodeKind ?? 'capability', id: node.id,
    title: node.title ?? '', summary: node.summary ?? '', parent: node.parent ?? NO_PARENT, idTouched: true, at: { x: 0, y: 0 }
  });
}
function onNodeDoubleClick(event: { node: { id: string } }) {
  openEdit(event.node.id);
}
function saveEdit() {
  if (nodeProblem.value || !standard) return;
  const changes = {
    title: nodeForm.title.trim(), summary: nodeForm.summary.trim(),
    parent: nodeForm.parent !== NO_PARENT ? nodeForm.parent : undefined,
    kind: nodeForm.kind !== standard.defaultNodeKind || props.template === 'sysdesign' ? nodeForm.kind : undefined
  };
  const base = shownCapabilities.value.find((item) => item.id === nodeForm.id);
  if (!base) return;
  changeNode(base, changes);
  nodeForm.open = false;
  void rebuild(false);
}
function changeNode(base: FlowCapability, changes: { parent?: string | undefined; kind?: string | undefined; title?: string; summary?: string }) {
  const kept = { ...base };
  Reflect.deleteProperty(kept, 'declaredBy');
  Reflect.deleteProperty(kept, 'pending');
  const next = clean({ ...kept, ...changes } as FlowCapability);
  const freshAt = freshNodes.value.findIndex((item) => item.id === base.id);
  if (freshAt !== -1) {
    freshNodes.value[freshAt] = next;
  } else {
    editedNodes.value = [...editedNodes.value.filter((item) => item.id !== next.id), next];
  }
}
/** Пустое поле — значит поля нет: `undefined` в записи карты не пишется. */
function clean(node: FlowCapability): FlowCapability {
  return Object.fromEntries(Object.entries(node).filter(([, value]) => value !== undefined && value !== '')) as unknown as FlowCapability;
}

/** Delete убирает выбранное: новое — с холста, подтверждённое — разделом `removed` черновика. */
function removeSelected() {
  const nodeIds = getSelectedNodes.value.map((node) => node.id);
  const edgeList = getSelectedEdges.value.filter((edge) => !(edge.data as { structural?: boolean } | undefined)?.structural);
  if (nodeIds.length === 0 && edgeList.length === 0) return;
  const freshIds = new Set(freshNodes.value.map((node) => node.id));
  freshNodes.value = freshNodes.value.filter((node) => !nodeIds.includes(node.id));
  editedNodes.value = editedNodes.value.filter((node) => !nodeIds.includes(node.id));
  removedNodes.value = [...new Set([...removedNodes.value, ...nodeIds.filter((id) => !freshIds.has(id))])];
  const gone = new Set(nodeIds);
  freshEdges.value = freshEdges.value.filter((edge) => !gone.has(edge.from) && !gone.has(edge.to));
  for (const edge of edgeList) {
    const relation = { from: edge.source, to: edge.target, type: String((edge.data as { kind?: string } | undefined)?.kind ?? '') };
    const freshAt = freshEdges.value.findIndex((item) => edgeKey(item) === edgeKey(relation));
    if (freshAt !== -1) freshEdges.value.splice(freshAt, 1);
    else removedEdges.value = [...removedEdges.value, relation];
  }
  void rebuild(false);
}
function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    removeSelected();
  }
}

function addNode() {
  if (nodeForm.mode === 'edit') { saveEdit(); return; }
  if (nodeProblem.value || !standard) return;
  const item: FlowCapability = {
    id: nodeForm.id, title: nodeForm.title.trim(), summary: nodeForm.summary.trim(),
    ...(nodeForm.parent !== NO_PARENT ? { parent: nodeForm.parent } : {}),
    ...(nodeForm.kind !== standard.defaultNodeKind || props.template === 'sysdesign' ? { kind: nodeForm.kind } : {}),
    ...(props.template === 'strategic' ? { status: 'not_implemented' } : {})
  };
  freshNodes.value.push(item);
  moved.set(item.id, nodeForm.at);
  nodeForm.open = false;
  void rebuild(false);
}

const groupForm = reactive({ open: false, title: '', summary: '', members: [] as string[] });
const selection = computed(() => {
  const ids = new Set(getSelectedNodes.value.map((node) => node.id));
  return shownCapabilities.value.filter((node) => ids.has(node.id));
});
const canGroup = computed(() => selection.value.length > 1 && new Set(selection.value.map((node) => node.parent)).size === 1);
function openGroup() {
  if (!canGroup.value) return;
  Object.assign(groupForm, { open: true, title: '', summary: '', members: selection.value.map((node) => node.id) });
  menu.value = null;
}
function createGroup() {
  const title = groupForm.title.trim(), summary = groupForm.summary.trim();
  const members = shownCapabilities.value.filter((node) => groupForm.members.includes(node.id));
  const parent = members[0]?.parent;
  if (!title || !summary || members.length < 2 || members.some((node) => node.parent !== parent)) return;
  const id = suggestId(title, taken.value, parent);
  const kind = props.template === 'domain' ? 'context' : props.template === 'sysdesign' ? 'container' : undefined;
  freshNodes.value.push({ id, title, summary, ...(parent ? { parent } : {}), ...(kind ? { kind } : {}) });
  for (const node of members) changeNode(node, { parent: id });
  groupForm.open = false;
  void rebuild(false);
}

// Соединение мышью: от порта к порту, затем вид связи и подпись.
const edgeForm = reactive({ open: false, from: '', to: '', type: '', summary: '' });
const edgeKinds = computed(() => (standard?.edgeKinds ?? []).map((kind) => ({ label: kind.title, value: kind.id })));
function onConnect(connection: Connection) {
  if (!connection.source || !connection.target || connection.source === connection.target) return;
  Object.assign(edgeForm, { open: true, from: connection.source, to: connection.target, type: standard?.edgeKinds[0]?.id ?? '', summary: '' });
}
const edgeKindNeedsLabel = computed(() => {
  const kind = standard?.edgeKinds.find((item) => item.id === edgeForm.type);
  return kind?.label === 'required' || kind?.label === 'format';
});
const chosenKind = computed(() => standard?.edgeKinds.find((item) => item.id === edgeForm.type));
const edgeProblem = computed(() => shownRelations.value.concat(freshEdges.value).some((item) =>
  edgeKey(item) === edgeKey(edgeForm) || (chosenKind.value?.twoWay &&
    item.type === edgeForm.type && item.from === edgeForm.to && item.to === edgeForm.from)));
function reverseEdge() {
  const { from, to } = edgeForm;
  Object.assign(edgeForm, { from: to, to: from });
}
function addEdge() {
  if (!standard || !edgeForm.type || edgeProblem.value || (edgeKindNeedsLabel.value && !edgeForm.summary.trim())) return;
  freshEdges.value.push({ from: edgeForm.from, to: edgeForm.to, type: edgeForm.type, ...(edgeForm.summary.trim() ? { summary: edgeForm.summary.trim() } : {}) });
  edgeForm.open = false;
  void rebuild(false);
}

const pendingCount = computed(() => freshNodes.value.length + freshEdges.value.length + editedNodes.value.length + removedNodes.value.length + removedEdges.value.length);
function clearEdits() {
  freshNodes.value = [];
  freshEdges.value = [];
  editedNodes.value = [];
  removedNodes.value = [];
  removedEdges.value = [];
}
/** Убранный узел уносит свои подтверждённые связи: иначе на карте остались бы связи в никуда. */
const removedRelations = computed(() => {
  const gone = new Set(removedNodes.value);
  const touching = props.relations.filter((edge) => gone.has(edge.from) || gone.has(edge.to));
  const all = new Map([...removedEdges.value, ...touching].map((edge) => [edgeKey(edge), { from: edge.from, to: edge.to, type: edge.type }]));
  return [...all.values()];
});
function reset() {
  clearEdits();
  failure.value = null;
  void rebuild(false);
}

const saving = ref(false);
const preview = ref(false);
const failure = ref<{ message: string; blockers: string[] } | null>(null);
const savedNote = ref('');
const draft = computed(() => visualMapDraft(props.template, [...freshNodes.value, ...editedNodes.value],
  freshEdges.value, removedNodes.value, removedRelations.value));
async function save() {
  if (pendingCount.value === 0 || !allowed('edit_draft').allowed) return;
  saving.value = true;
  failure.value = null;
  savedNote.value = '';
  try {
    const titles = [...freshNodes.value, ...editedNodes.value].map((node) => node.title ?? node.id).concat(removedNodes.value.map((id) => `−${id}`));
    const response = await $fetch<{ record?: { id: string }; error?: { message: string; blockers?: { message: string }[] } }>(
      `/api/projects/${props.projectId}/map/draft`,
      { method: 'POST', body: { answer: draft.value, title: t('maps.editor.draftTitle', { what: titles.length ? titles.join(', ') : t('maps.editor.links') }) }, ignoreResponseError: true }
    );
    if (response.error) {
      failure.value = { message: response.error.message, blockers: (response.error.blockers ?? []).map((item) => item.message) };
      return;
    }
    const id = response.record?.id ?? '';
    savedNote.value = t('maps.editor.saved', { id });
    preview.value = false;
    clearEdits();
    await rebuild(false);
    emit('saved', id);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div v-if="allowed('edit_draft').allowed" class="space-y-2" data-map-editor
    :class="fullscreen ? 'fixed inset-0 z-[65] flex flex-col bg-default p-3' : ''">
    <div class="flex flex-wrap items-center gap-2">
      <p class="text-sm text-muted">{{ t('maps.editor.hint') }} {{ t('maps.editor.selectHint') }}</p>
      <UButton size="sm" variant="soft" icon="i-lucide-boxes" :disabled="!canGroup" @click="openGroup">{{ t('mapGroup.new') }}</UButton>
      <UButton class="ml-auto" size="sm" variant="soft" color="neutral" icon="i-lucide-network" @click="rebuild(true)">{{ t('maps.editor.layout') }}</UButton>
      <UButton size="sm" variant="ghost" color="neutral" :icon="fullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
        :aria-pressed="fullscreen" @click="fullscreen = !fullscreen">{{ t(fullscreen ? 't83.m2.fs.exit' : 't83.m2.fs.enter') }}</UButton>
      <UButton size="sm" variant="ghost" color="neutral" :disabled="pendingCount === 0" @click="reset">{{ t('maps.editor.reset') }}</UButton>
      <UButton size="sm" icon="i-lucide-file-search" :disabled="pendingCount === 0" @click="preview = true">
        {{ t('mapGroup.preview') }}
      </UButton>
    </div>
    <UAlert v-if="failure" color="error" variant="subtle" :title="failure.message">
      <template #description>
        <ul class="list-disc pl-4">
          <li v-for="line in failure.blockers" :key="line">{{ line }}</li>
        </ul>
      </template>
    </UAlert>
    <p v-if="savedNote" class="text-sm text-success" data-map-editor-saved>{{ savedNote }}</p>

    <div ref="shell" class="relative overflow-hidden rounded-lg border border-default"
      :class="fullscreen ? 'min-h-0 flex-1' : 'h-[560px]'" tabindex="0" data-map-editor-canvas @click="menu = null" @keydown="onKey">
      <VueFlow
        :id="FLOW_ID"
        v-model:nodes="nodes"
        v-model:edges="edges"
        :min-zoom="0.1"
        :max-zoom="2"
        :default-edge-options="{ type: 'default' }"
        :connection-radius="24"
        :delete-key-code="null"
        selection-key-code="Shift"
        multi-selection-key-code="Shift"
        @pane-context-menu="onPaneMenu"
        @connect="onConnect"
        @node-drag-stop="onNodeDragStop"
        @node-double-click="onNodeDoubleClick"
      >
        <template #node-map="node">
          <div
            class="relative flex h-[84px] w-[240px] flex-col justify-center px-7 text-left"
            :class="{ 'outline outline-2 outline-primary': node.selected }"
            :data-flow-node="node.id"
          >
            <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" class="pointer-events-none absolute inset-0 -z-10 size-full">
              <path :d="MAP_SHAPES[shapes.get(node.data.kind) ?? 'rounded']" fill="var(--ui-bg)" :stroke="node.data.color"
                :stroke-dasharray="node.data.fresh ? '6 3' : undefined" stroke-width="2" vector-effect="non-scaling-stroke" />
            </svg>
            <div class="space-y-0.5">
              <p class="flex items-center gap-1 text-xs" :style="{ color: node.data.color }">
                <UIcon :name="node.data.icon" class="size-3.5" />{{ node.data.kindTitle }}
              </p>
              <p class="truncate text-sm font-medium">{{ node.data.title }}</p>
              <p class="line-clamp-2 text-xs text-muted">{{ node.data.summary }}</p>
            </div>
            <Handle id="in" type="target" :position="Position.Left" />
            <Handle id="out" type="source" :position="Position.Right" />
          </div>
        </template>
        <MiniMap pannable zoomable />
        <Controls :show-interactive="false" />
      </VueFlow>

      <div
        v-if="menu"
        class="absolute z-10 w-56 rounded-lg border border-default bg-default p-2 shadow-lg"
        :style="{ left: `${menu.x}px`, top: `${menu.y}px` }"
        data-map-editor-menu
        @click.stop
      >
        <UButton v-if="canGroup" size="xs" variant="ghost" icon="i-lucide-boxes" @click="openGroup">{{ t('mapGroup.new') }}</UButton>
        <p class="mb-1 text-xs font-medium text-muted">{{ t('maps.editor.addNode') }}</p>
        <UInput v-model="menuQuery" size="xs" autofocus :placeholder="t('maps.editor.searchKind')" class="mb-1 w-full" />
        <button
          v-for="kind in kinds"
          :key="kind.id"
          type="button"
          class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-elevated"
          :data-kind="kind.id"
          @click="pickKind(kind.id)"
        >
          <UIcon v-if="kind.icon" :name="kind.icon" class="size-4" />{{ kind.title }}
        </button>
        <p v-if="!kinds.length" class="px-2 py-1 text-xs text-muted">{{ t('maps.editor.noKind') }}</p>
      </div>
    </div>

    <UModal v-model:open="nodeForm.open" :title="nodeForm.mode === 'edit' ? t('maps.editor.editTitle', { id: nodeForm.id }) : t('maps.editor.nodeTitle')">
      <template #body>
        <div class="space-y-3" data-map-editor-node-form>
          <UFormField :label="t('maps.editor.fTitle')"><UInput v-model="nodeForm.title" class="w-full" name="title" /></UFormField>
          <UFormField :label="t('maps.editor.fSummary')"><UTextarea v-model="nodeForm.summary" class="w-full" :rows="2" name="summary" /></UFormField>
          <UFormField :label="t('maps.editor.fNodeKind')"><USelect v-model="nodeForm.kind" :items="nodeKinds" class="w-full" /></UFormField>
          <UFormField :label="t('maps.editor.fParent')"><USelect v-model="nodeForm.parent" :items="parentItems" class="w-full" /></UFormField>
          <UFormField :label="t('maps.editor.fId')"><UInput v-model="nodeForm.id" class="w-full font-mono" name="id" :disabled="nodeForm.mode === 'edit'" @update:model-value="nodeForm.idTouched = true" /></UFormField>
          <p v-if="nodeProblem" class="text-xs text-muted">{{ nodeProblem }}</p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="nodeForm.open = false">{{ t('maps.editor.cancel') }}</UButton>
            <UButton :disabled="!!nodeProblem" data-map-editor-add-node @click="addNode">{{ nodeForm.mode === 'edit' ? t('maps.editor.apply') : t('maps.editor.add') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="groupForm.open" :title="t('mapGroup.new')">
      <template #body>
        <div class="space-y-3" data-map-editor-group-form>
          <UFormField :label="t('mapGroup.title')"><UInput v-model="groupForm.title" class="w-full" name="group-title" /></UFormField>
          <UFormField :label="t('mapGroup.summary')"><UTextarea v-model="groupForm.summary" class="w-full" name="group-summary" /></UFormField>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="groupForm.open = false">{{ t('maps.editor.cancel') }}</UButton>
            <UButton :disabled="!groupForm.title.trim() || !groupForm.summary.trim()" @click="createGroup">{{ t('mapGroup.new') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="edgeForm.open" :title="t('maps.editor.edgeTitle', { from: edgeForm.from, to: edgeForm.to })">
      <template #body>
        <div class="space-y-3" data-map-editor-edge-form>
          <UFormField :label="t('maps.editor.fKind')"><USelect v-model="edgeForm.type" :items="edgeKinds" class="w-full" /></UFormField>
          <UFormField :label="edgeKindNeedsLabel ? t('maps.editor.fLabelRequired') : t('maps.editor.fLabel')"><UInput v-model="edgeForm.summary" class="w-full" name="label" /></UFormField>
          <UButton v-if="!chosenKind?.twoWay" variant="ghost" icon="i-lucide-arrow-left-right" @click="reverseEdge">{{ t('maps.editor.reverse') }}</UButton>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="edgeForm.open = false">{{ t('maps.editor.cancel') }}</UButton>
            <UButton :disabled="!edgeForm.type || edgeProblem || (edgeKindNeedsLabel && !edgeForm.summary.trim())" data-map-editor-add-edge @click="addEdge">{{ t('maps.editor.connect') }}</UButton>
          </div>
        </div>
      </template>
    </UModal>

    <UModal v-model:open="preview" :title="t('mapGroup.preview')">
      <template #body>
        <div class="space-y-3">
          <p v-if="failure" class="text-sm text-error" role="alert">{{ failure.message }}</p>
          <pre class="max-h-96 overflow-auto rounded bg-elevated p-3 text-xs">{{ draft }}</pre>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="preview = false">{{ t('maps.editor.cancel') }}</UButton>
            <UButton icon="i-lucide-save" :loading="saving" data-map-editor-save @click="save">{{ t('maps.editor.save', { n: pendingCount }) }}</UButton>
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>

<style>
.vue-flow__edge.map-flow-fresh .vue-flow__edge-path { stroke: var(--ui-primary); }
.vue-flow__minimap { background: var(--ui-bg-elevated); }
.vue-flow__edge-textbg { fill: var(--ui-bg); }
.vue-flow__edge-text { fill: var(--ui-text-muted); font-size: 11px; }
</style>
