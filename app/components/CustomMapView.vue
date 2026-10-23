<script setup lang="ts">
// Одна пользовательская карта (docs/adr/0028-custom-maps.md). По п. 3 ADR она рисуется
// теми же деревом и графом, что стратегическая: FunctionalTree пишет правки в маршрут
// этой карты (`…/maps/custom/:mapId/node`), граф — functionalMermaid с уровнями, режимами
// и легендой. Любая правка заводит черновик `map`, а не меняет карту.
import {
  HORIZONS,
  HORIZON_LABEL,
  IMPL_LABEL,
  IMPL_STATUSES,
  NO_RELATION_MARKS,
  PRIORITIES,
  PRIORITY_LABEL,
  groupLevel,
  queueRelationRemove,
  withMarks,
  withRelationMarks,
  type Horizon,
  type Mark,
  type Priority,
  type RelationMarks,
  type RelationType
} from '~~/server/lib/functional';
import { ancestors, depthOf } from '~~/server/lib/hierarchy';
import { slugify } from '~~/server/lib/scaffold';
import type { CustomNodeView, CustomRelationView } from '~~/server/lib/custom-maps';
import type { CustomMapDefinition } from '~~/server/lib/types';
import { functionalMermaid, fromNodeId, type FunctionalMode, type MapSelection } from '~/utils/map-mermaid';
import type { Capability } from './FunctionalTreeNode.vue';
const { t } = useT();

const props = defineProps<{
  projectId: string;
  definition: CustomMapDefinition;
  nodes: CustomNodeView[];
  relations: CustomRelationView[];
}>();
const emit = defineEmits<{ changed: [] }>();

const view = ref<'tree' | 'graph'>('tree');
const hasStatus = computed(() => props.definition.features.includes('status'));
const hasPriority = computed(() => props.definition.features.includes('priority'));
const hasHorizon = computed(() => props.definition.features.includes('horizon'));
const kindLabel = computed(() => new Map(props.definition.relations.map((item) => [item.id, item.label])));
/** Вид связи карты → один из пяти стилей: по нему граф рисует стрелку, считает «ждёт» и циклы. */
const styleOf = computed(() => new Map(props.definition.relations.map((item) => [item.id, item.style])));
const endpoint = computed(() => `/api/projects/${props.projectId}/maps/custom/${props.definition.id}/node`);

// Несохранённые отметки и связи — пачкой, как у стратегической карты; другая карта — другая пачка.
const marks = ref<Record<string, Mark>>({});
const relationMarks = ref<RelationMarks>(NO_RELATION_MARKS);
watch(() => props.definition.id, () => {
  marks.value = {};
  relationMarks.value = NO_RELATION_MARKS;
  selection.value = null;
});

// Узлы с висячим родителем поднимаем в корень: иначе дерево их не покажет вовсе.
const saved = computed<Capability[]>(() => {
  const ids = new Set(props.nodes.map((node) => node.id));
  return props.nodes.map((node) => (node.parent && ids.has(node.parent) ? node : { ...node, parent: undefined })) as Capability[];
});
const tree = computed<Capability[]>(() => withMarks(saved.value, marks.value));
const relations = computed(() => withRelationMarks(props.relations, relationMarks.value));

// Группа, глубина и раскрытие — в адресе (ADR-0027), их пишет MapDepthBar.
const route = useRoute();
const router = useRouter();
const group = computed(() => {
  const id = String(route.query['cgroup'] ?? '');
  return tree.value.some((node) => node.id === id) ? id : null;
});
const opened = computed(() => !!group.value && String(route.query['copen'] ?? '') === group.value);
/** Сколько уровней показывать ниже точки обзора; «все» и пусто — без предела. */
const levels = computed(() => {
  const wanted = String(route.query['cdepth'] ?? '');
  return /^[1-9]$/.test(wanted) ? Number(wanted) : Number.POSITIVE_INFINITY;
});

// Фильтры только читают: сужают картину, ничего не записывая (как у стратегической карты).
const UNRATED = 'unrated';
const NONE = 'none';
const statusFilter = ref<string[]>([]);
const priorityFilter = ref<string | null>(null);
const horizonFilter = ref<string | null>(null);
const hiddenKinds = ref<string[]>([]);
const search = ref('');
function resetFilters() {
  statusFilter.value = [];
  priorityFilter.value = null;
  horizonFilter.value = null;
  hiddenKinds.value = [];
  search.value = '';
}
watch(() => props.definition.id, resetFilters);
const filtering = computed(
  () => statusFilter.value.length > 0 || !!priorityFilter.value || !!horizonFilter.value || !!search.value.trim()
);
function matches(node: Capability): boolean {
  if (hasStatus.value && statusFilter.value.length && !statusFilter.value.includes(node.status ?? UNRATED)) return false;
  if (hasPriority.value && priorityFilter.value && (node.priority ?? NONE) !== priorityFilter.value) return false;
  if (hasHorizon.value && horizonFilter.value && (node.horizon ?? NONE) !== horizonFilter.value) return false;
  const needle = search.value.trim().toLowerCase();
  return !needle || (node.title ?? node.id).toLowerCase().includes(needle) || node.id.toLowerCase().includes(needle);
}

/** Узлы после фильтров и выбора группы. Предки совпавших остаются, чтобы дерево не рвалось. */
const kept = computed<Set<string>>(() => {
  const all = tree.value;
  let ids = all.map((node) => node.id);
  if (filtering.value) {
    const hit = new Set<string>();
    for (const node of all) {
      if (!matches(node)) continue;
      hit.add(node.id);
      for (const up of ancestors(node.id, all)) hit.add(up);
    }
    ids = ids.filter((id) => hit.has(id));
  }
  // «Раскрыть на месте» оставляет соседей; простой выбор группы сужает картину до её поддерева.
  if (group.value && !opened.value) {
    const root = group.value;
    ids = ids.filter((id) => id === root || ancestors(id, all).includes(root));
  }
  return new Set(ids);
});
const shownNodes = computed(() => tree.value.filter((node) => kept.value.has(node.id)));
const shownRelations = computed(() =>
  relations.value.filter((edge) => !hiddenKinds.value.includes(edge.type) && kept.value.has(edge.from) && kept.value.has(edge.to))
);

const kindCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const edge of props.relations) counts[edge.type] = (counts[edge.type] ?? 0) + 1;
  return counts;
});
function toggleKind(kind: string) {
  hiddenKinds.value = hiddenKinds.value.includes(kind)
    ? hiddenKinds.value.filter((item) => item !== kind)
    : [...hiddenKinds.value, kind];
}
const statusItems = computed(() =>
  [...IMPL_STATUSES, UNRATED].map((value) => ({ label: IMPL_LABEL[value as keyof typeof IMPL_LABEL], value }))
);
const priorityItems = computed(() => [
  ...PRIORITIES.map((value) => ({ label: PRIORITY_LABEL[value], value })),
  { label: t('t83.m2.noPriority'), value: NONE }
]);
const horizonItems = computed(() => [
  ...HORIZONS.map((value) => ({ label: HORIZON_LABEL[value], value })),
  { label: t('t83.m2.noHorizon'), value: NONE }
]);
const splitNodes = computed(() => tree.value.map((node) => ({ id: node.id, parent: node.parent })));
const splitEdges = computed(() => props.relations.map((edge) => ({ from: edge.from, to: edge.to, kind: edge.type })));

// --- граф: то же, что у стратегической карты (docs/04-ui.md, «Уровни графа», «Режимы окраски») ---
const GROUPED = 25;
/** Связи в стилях: граф и «ждёт» знают только пять видов. */
const styledRelations = computed(() =>
  shownRelations.value.map((edge) => ({ ...edge, type: (styleOf.value.get(edge.type) ?? edge.type) as RelationType }))
);
const groups = computed(() => groupLevel(shownNodes.value, styledRelations.value).groups);
/** Открытая группа графа — только узел верхнего уровня: так её понимают призраки и уровень `group`. */
const topGroup = computed(() => (group.value && !tree.value.find((node) => node.id === group.value)?.parent ? group.value : null));
const level = computed<'groups' | 'group' | 'all'>(() => {
  if (topGroup.value && !opened.value) return 'group';
  if (group.value) return 'all';
  const wanted = String(route.query['cview'] ?? '');
  if (wanted === 'all' || groups.value.length < 2) return 'all';
  if (wanted === 'groups') return 'groups';
  return shownNodes.value.length > GROUPED ? 'groups' : 'all';
});
const groupTitle = computed(() => tree.value.find((node) => node.id === group.value)?.title ?? group.value ?? '');
/** Покрытия процессом у рабочей карты нет: «Покрытие» и «Риски» красить нечем, остаются «Состояние» и «Порядок». */
const mode = computed<FunctionalMode>({
  get: () => (String(route.query['cmode'] ?? '') === 'order' ? 'order' : 'state'),
  set: (value) => { void router.replace({ query: { ...route.query, cmode: value === 'order' ? 'order' : undefined } }); }
});
const graphHiddenKinds = ref<string[]>([]);
const planPriority = ref<Priority | 'none' | null>(null);
const planHorizon = ref<Horizon | 'none' | null>(null);
const onlyRisks = ref(false);
const styleCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const edge of styledRelations.value) counts[edge.type] = (counts[edge.type] ?? 0) + 1;
  return counts;
});
/** Глубина графа от верхних узлов: у выбранной группы её дети — первый уровень. */
const maxDepth = computed(() => {
  if (!Number.isFinite(levels.value)) return undefined;
  return group.value && !opened.value ? levels.value + 1 : levels.value;
});
const selection = ref<MapSelection | null>(null);
const focus = ref<string | null>(null);
const impactOn = ref(false);
const graph = computed(() => functionalMermaid(
  { functional: { capabilities: shownNodes.value, relations: styledRelations.value } } as Parameters<typeof functionalMermaid>[0],
  null,
  {
    mode: mode.value,
    level: level.value,
    group: level.value === 'group' ? topGroup.value : null,
    hiddenKinds: new Set(graphHiddenKinds.value),
    plan: { priority: planPriority.value, horizon: planHorizon.value },
    onlyRisks: onlyRisks.value,
    legendInside: false,
    selected: focus.value,
    impact: impactOn.value,
    maxDepth: maxDepth.value
  }
));
const pendingIds = computed(() => new Set(Object.entries(graph.value.nodes ?? {}).filter(([, node]) => node.pending).map(([key]) => key)));
const ghostIds = computed(() => new Set(Object.entries(graph.value.nodes ?? {}).filter(([, node]) => node.ghost).map(([key]) => key)));

function go(query: Record<string, string | undefined>) {
  selection.value = null;
  void router.push({ query: { ...route.query, cview: undefined, cgroup: undefined, copen: undefined, ...query } });
}
const showGroups = () => go({ cview: 'groups' });
const showAll = () => go({ cview: 'all' });
const enterGroup = (id: string) => go({ cgroup: id });

watch(selection, (value) => {
  if (!value) {
    focus.value = null;
    impactOn.value = false;
  } else if (value.kind === 'node' && value.capability && !value.ghost && focus.value !== value.id) {
    focus.value = value.id;
    impactOn.value = false;
  }
});
function onNodeClick(key: string) {
  const node = graph.value.nodes?.[key];
  if (node) selection.value = { kind: 'node', ...node };
}
function onNodeDblClick(key: string) {
  const node = graph.value.nodes?.[key];
  if (level.value === 'groups' && node?.capabilityGroup) enterGroup(node.capabilityGroup);
}
const titles = computed<Record<string, string>>(() => Object.fromEntries(tree.value.map((node) => [node.id, node.title ?? node.id])));

/** Карточка убирает связь в стиле графа — находим, какой из видов карты за ней стоит. */
function removeRelation(relation: { from: string; to: string; type: string }) {
  const own = relations.value.find((edge) => edge.from === relation.from && edge.to === relation.to
    && (edge.type === relation.type || styleOf.value.get(edge.type) === relation.type));
  if (!own) return;
  relationMarks.value = queueRelationRemove(relationMarks.value, { from: own.from, to: own.to, type: own.type }, props.relations);
}

/** Латиница для id узла: та же транслитерация, что у id карты в форме. */
function idOf(title: string): string {
  return slugify(title, 40) || `node-${props.nodes.length + 1}`;
}

const treeRelations = computed(() => withRelationMarks(props.relations, relationMarks.value));
const depthOfGroup = computed(() => (group.value ? depthOf(group.value, tree.value) : -1));
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <div>
          <h2 class="font-medium">{{ definition.title }}</h2>
          <p v-if="definition.summary" class="text-sm text-muted">{{ definition.summary }}</p>
        </div>
        <UTabs
          v-model="view"
          class="ml-auto w-40"
          size="xs"
          :items="[{ label: t('t83.m2.tree'), value: 'tree' }, { label: t('t83.m2.graph'), value: 'graph' }]"
        />
      </div>
    </template>

    <div class="space-y-4">
      <MapDepthBar kind="custom" :tree="tree" />
      <MapSplitHints v-if="group" :group-id="group" :nodes="splitNodes" :edges="splitEdges" />

      <div v-if="nodes.length" class="flex flex-wrap items-center gap-2 text-sm">
        <UInput v-model="search" size="xs" icon="i-lucide-search" :placeholder="t('t83.custom-map-view.2')" class="w-48" />
        <USelectMenu
          v-if="hasStatus"
          v-model="statusFilter"
          multiple
          size="xs"
          class="w-48"
          value-key="value"
          :items="statusItems"
          :placeholder="t('t83.custom-map-view.3')"
        />
        <!-- В графе приоритет, горизонт и виды связей фильтрует панель графа — двух одинаковых полос не держим. -->
        <template v-if="view === 'tree'">
          <USelect
            v-if="hasPriority"
            :model-value="priorityFilter ?? undefined"
            size="xs"
            class="w-40"
            :items="priorityItems"
            :placeholder="t('t83.custom-map-view.4')"
            @update:model-value="(value) => (priorityFilter = value ? String(value) : null)"
          />
          <USelect
            v-if="hasHorizon"
            :model-value="horizonFilter ?? undefined"
            size="xs"
            class="w-40"
            :items="horizonItems"
            :placeholder="t('t83.custom-map-view.5')"
            @update:model-value="(value) => (horizonFilter = value ? String(value) : null)"
          />
          <UButton
            v-for="kind in definition.relations.filter((item) => kindCounts[item.id])"
            :key="kind.id"
            size="xs"
            color="neutral"
            :variant="hiddenKinds.includes(kind.id) ? 'outline' : 'soft'"
            :class="hiddenKinds.includes(kind.id) ? 'line-through opacity-60' : ''"
            :title="hiddenKinds.includes(kind.id) ? t('t83.m2.showKind') : t('t83.m2.hideKind')"
            @click="toggleKind(kind.id)"
          >
            {{ kindLabel.get(kind.id) ?? kind.id }} · {{ kindCounts[kind.id] }}
          </UButton>
        </template>
        <UButton
          v-if="filtering || hiddenKinds.length"
          size="xs"
          variant="link"
          color="neutral"
          :label="t('t83.custom-map-view.6')"
          @click="resetFilters"
        />
      </div>

      <!-- Всегда на месте: в режиме «Граф» прячется само дерево, а полосы сохранения остаются. -->
      <FunctionalTree
        v-model:marks="marks"
        v-model:relation-marks="relationMarks"
        :tree-hidden="view !== 'tree'"
        :project-id="projectId"
        :capabilities="shownNodes"
        :saved="saved"
        :relations="treeRelations.filter((edge) => kept.has(edge.from) && kept.has(edge.to) && !hiddenKinds.includes(edge.type))"
        :saved-relations="props.relations"
        :filter="null"
        :endpoint="endpoint"
        :relation-kinds="definition.relations"
        :id-of="idOf"
        @select="(value) => (selection = value)"
        @changed="emit('changed')"
      />

      <template v-if="view === 'graph'">
        <FunctionalGraphBar
          v-if="nodes.length"
          v-model:mode="mode"
          v-model:hidden-kinds="graphHiddenKinds"
          v-model:priority="planPriority"
          v-model:horizon="planHorizon"
          v-model:only-risks="onlyRisks"
          :level="level"
          :can-switch="groups.length >= 2 && depthOfGroup < 1"
          :group-title="groupTitle"
          :has-coverage="false"
          :kind-counts="styleCounts"
          @show-groups="showGroups"
          @show-all="showAll"
        />
        <FunctionalLegendBar v-if="graph.legend" :legend="graph.legend" />
        <p v-if="!graph.text" class="text-sm text-muted">{{ nodes.length ? t('t83.m2.nothingFilters') : t('t83.m2.nothingToDraw') }}</p>
        <MermaidDiagram
          v-else
          :id="`custom-${definition.id}`"
          :key="`${definition.id}:${level}:${group ?? ''}:${maxDepth ?? ''}`"
          :source="graph.text"
          :details="graph.details"
          :paths="graph.paths"
          :edges="graph.edges"
          :neighbors="graph.neighbors"
          :pending-ids="pendingIds"
          :ghost-ids="ghostIds"
          :focus-key="focus && level !== 'groups' ? fromNodeId(focus) : null"
          :keep-view="true"
          @node-click="onNodeClick"
          @node-dblclick="onNodeDblClick"
          @background-click="selection = null"
        />
      </template>
    </div>

    <MapInspector
      :project-id="projectId"
      :selection="selection"
      :capability-titles="titles"
      :impact-on="impactOn"
      @impact="impactOn = !impactOn"
      @unrelate="removeRelation"
      @close="selection = null"
      @open-group="enterGroup"
    />
  </UCard>
</template>
