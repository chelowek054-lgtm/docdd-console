<script setup lang="ts">
// Глубина карт (ADR-0027, docs/04-ui.md «Глубина карт»): путь «Все › А › Б»,
// «Глубина» 1, 2, 3, все и «Раскрыть на месте». Состояние только в адресе;
// дерево считается на клиенте чистыми функциями сервера, в файлы компонент не ходит.
import { ancestors, maxDepth, type TreeNode } from '~~/server/lib/hierarchy';
import { groupTree, type DeclaredGroup, type GroupImport, type GroupModule } from '~~/server/lib/groups';

const props = defineProps<{
  /** Какая карта: от неё зависит имя параметра группы в адресе. */
  kind: 'functional' | 'codemap' | 'dataflow';
  capabilities?: readonly { id: string; title?: string | undefined; parent?: string | undefined }[];
  modules?: readonly GroupModule[];
  imports?: readonly GroupImport[];
  groups?: readonly DeclaredGroup[];
}>();

const route = useRoute();
const router = useRouter();

/** У каждой карты свой параметр группы (так уже устроен адрес экрана). */
const groupKey = computed(() => (props.kind === 'functional' ? 'capgroup' : props.kind === 'dataflow' ? 'fgroup' : 'group'));

const nodes = computed<(TreeNode & { title: string })[]>(() => {
  if (props.kind === 'functional') {
    return (props.capabilities ?? []).map((item) => ({ id: item.id, parent: item.parent, title: item.title ?? item.id }));
  }
  return groupTree(props.modules ?? [], props.imports ?? [], props.groups ?? []).nodes
    .map((node) => ({ id: node.id, parent: node.parent, title: node.title }));
});

const deepest = computed(() => maxDepth(nodes.value));
const selected = computed(() => {
  const id = String(route.query[groupKey.value] ?? '');
  return nodes.value.some((node) => node.id === id) ? id : '';
});

/** Путь от корня к выбранной группе; звено — ссылка на свой уровень. */
const trail = computed(() => {
  if (!selected.value) return [];
  const titles = new Map(nodes.value.map((node) => [node.id, node.title]));
  return [...ancestors(selected.value, nodes.value).reverse(), selected.value]
    .map((id) => ({ id, title: titles.get(id) ?? id }));
});

const depth = computed(() => {
  const wanted = String(route.query['depth'] ?? '');
  return wanted === 'all' || /^[1-9]$/.test(wanted) ? wanted : '';
});
const levels = computed(() => [
  ...[1, 2, 3].filter((level) => level <= deepest.value + 1).map((level) => ({ value: String(level), label: String(level) })),
  { value: 'all', label: 'все' }
]);
const canOpen = computed(() => !!selected.value && nodes.value.some((node) => node.parent === selected.value));
const opened = computed(() => String(route.query['open'] ?? '') === selected.value && !!selected.value);

function change(query: Record<string, string | undefined>) {
  void router.push({ query: { ...route.query, ...query } });
}
const goGroup = (id: string | null) => change({ [groupKey.value]: id ?? undefined, open: undefined });
const setDepth = (value: string) => change({ depth: depth.value === value ? undefined : value, open: undefined });
const openInPlace = () => change({ open: opened.value ? undefined : selected.value });
</script>

<template>
  <div v-if="deepest > 0" class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
    <p class="flex flex-wrap items-center gap-1">
      <UButton size="xs" variant="link" color="neutral" :disabled="!selected" @click="goGroup(null)">Все</UButton>
      <template v-for="(step, i) in trail" :key="step.id">
        <span class="text-muted">›</span>
        <UButton v-if="i < trail.length - 1" size="xs" variant="link" color="neutral" @click="goGroup(step.id)">
          {{ step.title }}
        </UButton>
        <span v-else class="font-medium">{{ step.title }}</span>
      </template>
    </p>
    <div class="flex items-center gap-1">
      <span class="text-muted">Глубина</span>
      <UButton
        v-for="level in levels"
        :key="level.value"
        size="xs"
        color="neutral"
        :variant="depth === level.value ? 'solid' : 'outline'"
        @click="setDepth(level.value)"
      >
        {{ level.label }}
      </UButton>
    </div>
    <UButton
      v-if="canOpen"
      size="xs"
      color="neutral"
      :variant="opened ? 'solid' : 'outline'"
      icon="i-lucide-unfold-vertical"
      @click="openInPlace"
    >
      Раскрыть на месте
    </UButton>
  </div>
</template>
