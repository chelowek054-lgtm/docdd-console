<script setup lang="ts">
import { atLevel, countsText, diffCounts, onlyChangedIds, type DiffMark, type MapDiff, type StructureDiff } from '~~/server/lib/map-diff';
import { maxDepth, depthOf } from '~~/server/lib/hierarchy';

/**
 * Разница карты на схеме (R-0069). Подключение: `<MapDiff :diff="..." />`, где `diff` — ответ
 * `GET /api/projects/:id/records/:recordId/map-diff`. Дерево со вложенностью, цвета: добавленное
 * зелёное, убранное красное пунктиром, изменённое жёлтое; свёрнутая группа подсвечена числом внутри.
 */
const props = defineProps<{ diff: MapDiff }>();

const onlyChanged = ref(false);
const level = ref<Record<string, number>>({});

const LABEL: Record<string, string> = { codemap: 'Кодовая база', dataflow: 'Потоки данных', userflow: 'Пользовательские пути', functional: 'Функциональная карта', custom: 'Своя карта' };
const MARK_CLASS: Record<DiffMark, string> = {
  added: 'border-success text-success bg-success/10',
  removed: 'border-error text-error border-dashed bg-error/5 line-through',
  changed: 'border-warning text-warning bg-warning/10',
  same: 'border-default text-muted'
};

function treeNodes(structure: StructureDiff) {
  return structure.nodes.map((node) => ({ id: node.id, parent: node.parent }));
}
const depthMax = (structure: StructureDiff) => maxDepth(treeNodes(structure));

function view(structure: StructureDiff) {
  const at = level.value[structure.structure] ?? depthMax(structure);
  const shown = atLevel(structure, at);
  const keep = onlyChanged.value ? onlyChangedIds(structure) : null;
  const tree = treeNodes(structure);
  return {
    nodes: shown.nodes.filter((node) => keep === null || keep.has(node.id)).map((node) => ({ ...node, depth: depthOf(node.id, tree) })),
    edges: shown.edges.filter((edge) => keep === null || edge.mark !== 'same' || (keep.has(edge.from) && keep.has(edge.to)))
  };
}
const fieldsOf = (structure: StructureDiff, id: string) => structure.nodes.find((node) => node.id === id)?.fields.join(', ') ?? '';
</script>

<template>
  <div class="space-y-4">
    <label class="flex items-center gap-2 text-sm">
      <input v-model="onlyChanged" type="checkbox">
      Только изменённое с соседями
    </label>
    <section v-for="structure in diff.structures" :key="structure.structure" class="ds-card space-y-2 p-3">
      <header class="flex flex-wrap items-center gap-3">
        <h4 class="text-sm font-medium">{{ LABEL[structure.structure] ?? structure.structure }}</h4>
        <span class="font-mono text-xs">{{ countsText(diffCounts(structure)) }}</span>
        <label v-if="depthMax(structure) > 0" class="ml-auto flex items-center gap-2 text-xs text-muted">
          Глубина
          <input v-model.number="level[structure.structure]" type="range" min="0" :max="depthMax(structure)" :value="level[structure.structure] ?? depthMax(structure)">
        </label>
      </header>
      <ul class="space-y-1">
        <li v-for="node in view(structure).nodes" :key="node.id" :style="{ paddingLeft: `${node.depth * 16}px` }">
          <span class="inline-block rounded border px-2 py-0.5 text-sm" :class="MARK_CLASS[node.mark]">
            <span class="font-mono text-xs">{{ node.id }}</span> {{ node.title }}
            <span v-if="node.inside > 0 && (level[structure.structure] ?? depthMax(structure)) <= node.depth" class="text-xs"> · внутри: {{ node.inside }}</span>
            <span v-if="node.mark === 'changed' && fieldsOf(structure, node.id)" class="text-xs"> ({{ fieldsOf(structure, node.id) }})</span>
          </span>
        </li>
      </ul>
      <ul v-if="view(structure).edges.length" class="space-y-0.5 text-xs">
        <li v-for="edge in view(structure).edges" :key="`${edge.from}>${edge.to}`" class="font-mono">
          <span class="rounded border px-1" :class="MARK_CLASS[edge.mark]">{{ edge.from }} → {{ edge.to }}<template v-if="edge.count > 1"> ×{{ edge.count }}</template></span>
        </li>
      </ul>
    </section>
    <p v-if="!diff.structures.length" class="text-sm text-muted">Запись ничего не меняет в картине.</p>
  </div>
</template>
