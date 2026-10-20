<script setup lang="ts">
// Одна пользовательская карта (docs/adr/0028-custom-maps.md). FunctionalTree сохраняет
// правки в маршруты функциональной карты (`…/map/capability`), поэтому дерево здесь своё,
// а граф — тот же MermaidDiagram. Любая правка заводит черновик `map`, а не меняет карту.
import type { ApiFailure } from '~/composables/useProjectIndex';
import { HORIZONS, HORIZON_LABEL, IMPL_LABEL, IMPL_STATUSES, PRIORITIES, PRIORITY_LABEL } from '~~/server/lib/functional';
import { ancestors, depthOf, foldEdges, visibleAt, type Edge, type TreeNode } from '~~/server/lib/hierarchy';
import { slugify } from '~~/server/lib/scaffold';
import type { CustomNodeView, CustomRelationView } from '~~/server/lib/custom-maps';
import type { CustomMapDefinition, CustomRelationStyle } from '~~/server/lib/types';

const props = defineProps<{
  projectId: string;
  definition: CustomMapDefinition;
  nodes: CustomNodeView[];
  relations: CustomRelationView[];
}>();
const emit = defineEmits<{ changed: [] }>();

const view = ref<'tree' | 'graph'>('tree');
const hasStatus = computed(() => props.definition.features.includes('status'));
const kindLabel = computed(() => new Map(props.definition.relations.map((item) => [item.id, item.label])));

const hasPriority = computed(() => props.definition.features.includes('priority'));
const hasHorizon = computed(() => props.definition.features.includes('horizon'));

// Узлы с висячим родителем поднимаем в корень: иначе hierarchy.ts посчитает
// им глубину по несуществующему предку, а дерево их не покажет вовсе.
const tree = computed<CustomNodeView[]>(() => {
  const ids = new Set(props.nodes.map((node) => node.id));
  return props.nodes.map((node) => (node.parent && ids.has(node.parent) ? node : { ...node, parent: undefined }));
});
const edges = computed<Edge[]>(() =>
  props.relations.map((edge) => ({ from: edge.from, to: edge.to, kind: edge.type, ...(edge.verdict ? { verdict: edge.verdict } : {}) }))
);

// Группа, глубина и раскрытие — в адресе (ADR-0027), их пишет MapDepthBar.
const route = useRoute();
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

// Фильтры только читают: сужают картину, ничего не записывая (как у функциональной карты).
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
function matches(node: CustomNodeView): boolean {
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
const shownEdges = computed(() =>
  edges.value.filter((edge) => !hiddenKinds.value.includes(edge.kind ?? '') && kept.value.has(edge.from) && kept.value.has(edge.to))
);

/** Видимый представитель узла на текущей глубине (свёртка — hierarchy.ts). */
function visibleOf(id: string): string {
  const depth = Number.isFinite(levels.value) ? levels.value : 99;
  // Глубина 1 у корня — сами корни (уровень 0), у группы — её дети.
  return group.value ? visibleAt(id, tree.value, group.value, depth) : visibleAt(id, tree.value, null, depth - 1);
}

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
  { label: 'без приоритета', value: NONE }
]);
const horizonItems = computed(() => [
  ...HORIZONS.map((value) => ({ label: HORIZON_LABEL[value], value })),
  { label: 'без горизонта', value: NONE }
]);
const splitNodes = computed<TreeNode[]>(() => tree.value.map((node) => ({ id: node.id, parent: node.parent })));

interface Row { node: CustomNodeView; depth: number }
const rows = computed<Row[]>(() => {
  // Дерево режется той же глубиной, что и граф: от корня или от выбранной группы.
  const base = group.value ? depthOf(group.value, tree.value) + 1 : 0;
  return allRows.value.filter((row) => {
    if (!kept.value.has(row.node.id)) return false;
    if (!Number.isFinite(levels.value)) return true;
    return row.depth < base + levels.value || (!!group.value && opened.value && row.depth < base);
  });
});
const allRows = computed<Row[]>(() => {
  const ids = new Set(props.nodes.map((node) => node.id));
  const out: Row[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | undefined, depth: number) => {
    for (const node of props.nodes) {
      const own = node.parent && ids.has(node.parent) ? node.parent : undefined;
      if (own !== parent || seen.has(node.id)) continue;
      seen.add(node.id);
      out.push({ node, depth });
      walk(node.id, depth + 1);
    }
  };
  walk(undefined, 0);
  return out;
});

// Отметки состояния копятся пачкой и уходят одним черновиком.
const statusMarks = ref<Record<string, string>>({});
watch(() => props.definition.id, () => { statusMarks.value = {}; });

const busy = ref(false);
const error = ref<string | null>(null);
const draft = ref<string | null>(null);

type NodeAction =
  | { action: 'add'; node: { id: string; title: string; parent?: string } }
  | { action: 'remove'; node: { id: string } }
  | { action: 'relate' | 'unrelate'; relation: { from: string; to: string; type: string } }
  | { action: 'status'; statuses: Record<string, string> };

async function send(body: NodeAction): Promise<boolean> {
  busy.value = true;
  error.value = null;
  try {
    const response = await $fetch<{ record: { id: string } } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/maps/custom/${props.definition.id}/node`,
      { method: 'POST', body }
    );
    if ('error' in response) {
      error.value = response.error.message;
      return false;
    }
    draft.value = response.record.id;
    emit('changed');
    return true;
  } catch (failure: unknown) {
    const data = (failure as { data?: { error?: ApiFailure; message?: string } }).data;
    error.value = data?.error?.message ?? data?.message ?? (failure as Error).message;
    return false;
  } finally {
    busy.value = false;
  }
}

const newNode = reactive({ title: '', parent: '' });
async function addNode() {
  const title = newNode.title.trim();
  if (!title) return;
  const id = slugOf(title);
  const ok = await send({ action: 'add', node: { id, title, ...(newNode.parent ? { parent: newNode.parent } : {}) } });
  if (ok) Object.assign(newNode, { title: '', parent: '' });
}

const newRelation = reactive({ from: '', to: '', type: '' });
async function relate() {
  if (!newRelation.from || !newRelation.to || !newRelation.type) return;
  const ok = await send({ action: 'relate', relation: { ...newRelation } });
  if (ok) Object.assign(newRelation, { from: '', to: '' });
}

async function saveStatuses() {
  if (await send({ action: 'status', statuses: { ...statusMarks.value } })) statusMarks.value = {};
}

function slugOf(title: string): string {
  // Латиница для id узла: та же транслитерация, что у id карты в форме.
  return slugify(title, 40) || `node-${props.nodes.length + 1}`;
}

const nodeItems = computed(() => props.nodes.map((node) => ({ label: node.title ?? node.id, value: node.id })));
const shownRelations = computed(() =>
  props.relations.filter((edge) => !hiddenKinds.value.includes(edge.type) && kept.value.has(edge.from) && kept.value.has(edge.to))
);
const titleOf = (id: string) => props.nodes.find((node) => node.id === id)?.title ?? id;

// Стрелка mermaid под каждый из пяти стилей функциональной карты.
const ARROW: Record<CustomRelationStyle, string> = {
  depends: '-->',
  uses: '-.->',
  feeds: '==>',
  triggers: '--o',
  replaces: '--x'
};
// Граф строится по свёрнутой картине: узлы — видимые представители, связи
// схлопнуты foldEdges, на стрелке — вид и число исходных связей (×N).
const graphSource = computed(() => {
  const visible = new Map<string, string>();
  for (const node of shownNodes.value) visible.set(node.id, visibleOf(node.id));
  const drawn = [...new Set(visible.values())];
  const index = new Map(drawn.map((id, at) => [id, `n${at}`]));
  const byId = new Map(tree.value.map((node) => [node.id, node]));
  const style = new Map(props.definition.relations.map((item) => [item.id, item.style]));
  const quote = (text: string) => text.replace(/"/g, '#quot;');
  const lines = ['flowchart LR'];
  for (const id of drawn) {
    const hidden = shownNodes.value.filter((item) => visible.get(item.id) === id).length - 1;
    const title = (byId.get(id)?.title ?? id) + (hidden > 0 ? ` (+${hidden})` : '');
    lines.push(`  ${index.get(id)}["${quote(title)}"]`);
  }
  for (const id of drawn) {
    const parent = byId.get(id)?.parent;
    if (parent && index.has(parent)) lines.push(`  ${index.get(parent)} --- ${index.get(id)}`);
  }
  const { edges: folded } = foldEdges(shownEdges.value, (id) => visible.get(id) ?? id);
  for (const edge of folded) {
    const from = index.get(edge.from);
    const to = index.get(edge.to);
    if (!from || !to) continue;
    const single = edge.kinds.length === 1 ? style.get(edge.kinds[0] ?? '') : undefined;
    const arrow = ARROW[single ?? 'depends'];
    const label = edge.kinds.map((kind) => kindLabel.value.get(kind) ?? kind).join(', ') + (edge.count > 1 ? ` ×${edge.count}` : '');
    lines.push(`  ${from} ${arrow}|"${quote(label)}"| ${to}`);
  }
  return lines.join('\n');
});
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
          :items="[{ label: 'Дерево', value: 'tree' }, { label: 'Граф', value: 'graph' }]"
        />
      </div>
    </template>

    <div class="space-y-4">
      <UAlert
        v-if="draft"
        color="info"
        variant="subtle"
        icon="i-lucide-file-clock"
        :title="`Заведён черновик ${draft}`"
        description="Правка войдёт в карту, когда человек подтвердит черновик."
      />
      <UAlert v-if="error" color="error" variant="subtle" :description="error" />

      <MapDepthBar kind="custom" :tree="tree" />
      <MapSplitHints v-if="group" :group-id="group" :nodes="splitNodes" :edges="edges" />

      <div v-if="nodes.length" class="flex flex-wrap items-center gap-2 text-sm">
        <UInput v-model="search" size="xs" icon="i-lucide-search" placeholder="Поиск по названию" class="w-48" />
        <USelectMenu
          v-if="hasStatus"
          v-model="statusFilter"
          multiple
          size="xs"
          class="w-48"
          value-key="value"
          :items="statusItems"
          placeholder="Состояние: все"
        />
        <USelect
          v-if="hasPriority"
          :model-value="priorityFilter ?? undefined"
          size="xs"
          class="w-40"
          :items="priorityItems"
          placeholder="Приоритет: все"
          @update:model-value="(value) => (priorityFilter = value ? String(value) : null)"
        />
        <USelect
          v-if="hasHorizon"
          :model-value="horizonFilter ?? undefined"
          size="xs"
          class="w-40"
          :items="horizonItems"
          placeholder="Горизонт: все"
          @update:model-value="(value) => (horizonFilter = value ? String(value) : null)"
        />
        <UButton
          v-for="kind in definition.relations.filter((item) => kindCounts[item.id])"
          :key="kind.id"
          size="xs"
          color="neutral"
          :variant="hiddenKinds.includes(kind.id) ? 'outline' : 'soft'"
          :class="hiddenKinds.includes(kind.id) ? 'line-through opacity-60' : ''"
          :title="hiddenKinds.includes(kind.id) ? 'Показать вид связи' : 'Скрыть вид связи'"
          @click="toggleKind(kind.id)"
        >
          {{ kind.label }} · {{ kindCounts[kind.id] }}
        </UButton>
        <UButton
          v-if="filtering || hiddenKinds.length"
          size="xs"
          variant="link"
          color="neutral"
          label="Сбросить фильтры"
          @click="resetFilters"
        />
      </div>

      <template v-if="view === 'tree'">
        <p v-if="!nodes.length" class="text-sm text-muted">
          {{ definition.node.plural }} пока не описаны — добавьте первый узел ниже.
        </p>
        <ul class="space-y-1">
          <li
            v-for="row in rows"
            :key="row.node.id"
            class="flex items-center gap-2 text-sm"
            :class="row.node.pending ? 'opacity-60' : ''"
            :style="{ paddingLeft: `${row.depth * 1.25}rem` }"
          >
            <span class="font-medium">{{ row.node.title ?? row.node.id }}</span>
            <span class="font-mono text-xs text-muted">{{ row.node.id }}</span>
            <UBadge v-if="row.node.pending" size="sm" color="warning" variant="subtle" label="черновик" />
            <USelect
              v-if="hasStatus"
              class="ml-auto w-40"
              size="xs"
              :model-value="statusMarks[row.node.id] ?? row.node.status ?? 'unrated'"
              :items="[...IMPL_STATUSES, 'unrated'].map((value) => ({ label: IMPL_LABEL[value as keyof typeof IMPL_LABEL], value }))"
              @update:model-value="(value) => (statusMarks = { ...statusMarks, [row.node.id]: String(value) })"
            />
            <UButton
              :class="hasStatus ? '' : 'ml-auto'"
              icon="i-lucide-trash-2"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="`Убрать: ${definition.node.label}`"
              :disabled="busy"
              @click="send({ action: 'remove', node: { id: row.node.id } })"
            />
          </li>
        </ul>

        <div v-if="Object.keys(statusMarks).length" class="flex items-center gap-2 rounded-md bg-elevated p-2 text-sm">
          <span>Отмечено: {{ Object.keys(statusMarks).length }}</span>
          <UButton class="ml-auto" size="xs" label="Сохранить отметки" :loading="busy" @click="saveStatuses" />
          <UButton size="xs" color="neutral" variant="ghost" label="Сбросить" @click="statusMarks = {}" />
        </div>

        <div v-if="shownRelations.length" class="space-y-1">
          <p class="text-sm font-medium">Связи</p>
          <div v-for="edge in shownRelations" :key="`${edge.from}:${edge.type}:${edge.to}`" class="flex items-center gap-2 text-sm">
            <span>{{ titleOf(edge.from) }}</span>
            <span class="text-muted">{{ kindLabel.get(edge.type) ?? edge.type }}</span>
            <span>{{ titleOf(edge.to) }}</span>
            <UButton
              class="ml-auto"
              icon="i-lucide-unlink"
              size="xs"
              color="neutral"
              variant="ghost"
              title="Убрать связь"
              :disabled="busy"
              @click="send({ action: 'unrelate', relation: { from: edge.from, to: edge.to, type: edge.type } })"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <UInput v-model="newNode.title" size="sm" :placeholder="`Новый узел: ${definition.node.label}`" />
          <USelect v-model="newNode.parent" size="sm" class="w-48" :items="nodeItems" placeholder="Внутри (необязательно)" />
          <UButton size="sm" icon="i-lucide-plus" :label="`Добавить: ${definition.node.label}`" :disabled="busy" @click="addNode" />
        </div>
        <div v-if="nodes.length >= 2" class="flex flex-wrap items-center gap-2">
          <USelect v-model="newRelation.from" size="sm" class="w-44" :items="nodeItems" placeholder="От" />
          <USelect
            v-model="newRelation.type"
            size="sm"
            class="w-44"
            :items="definition.relations.map((item) => ({ label: item.label, value: item.id }))"
            placeholder="Вид связи"
          />
          <USelect v-model="newRelation.to" size="sm" class="w-44" :items="nodeItems" placeholder="К" />
          <UButton size="sm" icon="i-lucide-link" label="Связать" :disabled="busy" @click="relate" />
        </div>
      </template>

      <template v-else>
        <p v-if="!shownNodes.length" class="text-sm text-muted">{{ nodes.length ? 'Под фильтры ничего не попало.' : 'Рисовать пока нечего.' }}</p>
        <MermaidDiagram v-else :id="`custom-${definition.id}`" :source="graphSource" />
      </template>
    </div>
  </UCard>
</template>
