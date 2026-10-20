<script setup lang="ts">
// Одна пользовательская карта (docs/adr/0028-custom-maps.md). FunctionalTree сохраняет
// правки в маршруты функциональной карты (`…/map/capability`), поэтому дерево здесь своё,
// а граф — тот же MermaidDiagram. Любая правка заводит черновик `map`, а не меняет карту.
import type { ApiFailure } from '~/composables/useProjectIndex';
import { IMPL_LABEL, IMPL_STATUSES } from '~~/server/lib/functional';
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

interface Row { node: CustomNodeView; depth: number }
const rows = computed<Row[]>(() => {
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
const titleOf = (id: string) => props.nodes.find((node) => node.id === id)?.title ?? id;

// Стрелка mermaid под каждый из пяти стилей функциональной карты.
const ARROW: Record<CustomRelationStyle, string> = {
  depends: '-->',
  uses: '-.->',
  feeds: '==>',
  triggers: '--o',
  replaces: '--x'
};
const graphSource = computed(() => {
  const index = new Map(props.nodes.map((node, at) => [node.id, `n${at}`]));
  const style = new Map(props.definition.relations.map((item) => [item.id, item.style]));
  const quote = (text: string) => text.replace(/"/g, '#quot;');
  const lines = ['flowchart LR'];
  for (const node of props.nodes) lines.push(`  ${index.get(node.id)}["${quote(node.title ?? node.id)}"]`);
  for (const node of props.nodes) {
    if (node.parent && index.has(node.parent)) lines.push(`  ${index.get(node.parent)} --- ${index.get(node.id)}`);
  }
  for (const edge of props.relations) {
    const from = index.get(edge.from);
    const to = index.get(edge.to);
    if (!from || !to) continue;
    const arrow = ARROW[style.get(edge.type) ?? 'depends'];
    lines.push(`  ${from} ${arrow}|"${quote(kindLabel.value.get(edge.type) ?? edge.type)}"| ${to}`);
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

        <div v-if="relations.length" class="space-y-1">
          <p class="text-sm font-medium">Связи</p>
          <div v-for="edge in relations" :key="`${edge.from}:${edge.type}:${edge.to}`" class="flex items-center gap-2 text-sm">
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
        <p v-if="!nodes.length" class="text-sm text-muted">Рисовать пока нечего.</p>
        <MermaidDiagram v-else :id="`custom-${definition.id}`" :source="graphSource" />
      </template>
    </div>
  </UCard>
</template>
