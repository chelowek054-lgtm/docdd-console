<script setup lang="ts">
// Глубина карт (ADR-0027, docs/04-ui.md «Глубина карт»): путь «Все › А › Б»,
// «Глубина» 1, 2, 3, все и «Раскрыть на месте». Состояние только в адресе;
// дерево считается на клиенте чистыми функциями сервера, в файлы компонент не ходит.
import { ancestors, maxDepth, type TreeNode } from '~~/server/lib/hierarchy';
import { groupTree, type DeclaredGroup, type GroupImport, type GroupModule } from '~~/server/lib/groups';
const { t } = useT();

const props = defineProps<{
  /** Какая карта: от неё зависит имя параметра группы в адресе. */
  kind: 'functional' | 'codemap' | 'dataflow' | 'custom' | 'userflow';
  title?: string;
  standard?: boolean;
  /** Готовое дерево (пользовательские карты): узлы приходят как есть, без сборки групп. */
  tree?: readonly { id: string; title?: string | undefined; parent?: string | undefined }[];
  capabilities?: readonly { id: string; title?: string | undefined; parent?: string | undefined }[];
  modules?: readonly GroupModule[];
  imports?: readonly GroupImport[];
  groups?: readonly DeclaredGroup[];
}>();

const mapTitle = computed(() => props.title ?? t('maps.v.' + props.kind));
const route = useRoute();
const router = useRouter();
const fullscreenTarget = shallowRef<HTMLElement>();
function syncFullscreenTarget() {
  const root = document.fullscreenElement ?? document.querySelector('[data-map-expanded]');
  fullscreenTarget.value = root?.querySelector<HTMLElement>('[data-map-depth-target]') ?? undefined;
}
onMounted(() => {
  document.addEventListener('fullscreenchange', syncFullscreenTarget);
  document.addEventListener('docdd-map-expanded', syncFullscreenTarget);
  syncFullscreenTarget();
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', syncFullscreenTarget);
  document.removeEventListener('docdd-map-expanded', syncFullscreenTarget);
});

/** У каждой карты свой параметр группы (так уже устроен адрес экрана). */
const groupKey = computed(() =>
  props.kind === 'custom' ? 'cgroup' : props.kind === 'functional' ? 'capgroup' : props.kind === 'dataflow' ? 'fgroup' : 'group'
);
// У пользовательской карты свои имена глубины и раскрытия: её ?cmap= живёт рядом
// со встроенной вкладкой, и общий ?depth= не должен перескакивать между ними.
const depthKey = computed(() => (props.kind === 'custom' ? 'cdepth' : 'depth'));
const openKey = computed(() => (props.kind === 'custom' ? 'copen' : 'open'));

const nodes = computed<(TreeNode & { title: string })[]>(() => {
  if (props.kind === 'custom') {
    return (props.tree ?? []).map((item) => ({ id: item.id, parent: item.parent, title: item.title ?? item.id }));
  }
  if (props.kind === 'functional') {
    return (props.capabilities ?? []).map((item) => ({ id: item.id, parent: item.parent, title: item.title ?? item.id }));
  }
  const tree = groupTree(props.modules ?? [], props.imports ?? [], props.groups ?? []);
  const groups = tree.nodes.map((node) => ({ id: node.id, parent: node.parent, title: node.title }));
  if (!props.standard || props.kind !== 'codemap') return groups;
  const ids = new Set(groups.map((node) => node.id));
  const modules = new Map((props.modules ?? []).map((module) => [module.id, module.title ?? module.id]));
  for (const edge of props.imports ?? []) {
    if (!modules.has(edge.from)) modules.set(edge.from, edge.from);
    if (!modules.has(edge.to)) modules.set(edge.to, edge.to);
  }
  return [...groups, ...[...modules].filter(([id]) => !ids.has(id))
    .map(([id, title]) => ({ id, title, parent: tree.groupOf(id) }))];
});

const deepest = computed(() => maxDepth(nodes.value));
const selected = computed(() => {
  const id = String(route.query[groupKey.value] ?? '');
  return nodes.value.some((node) => node.id === id) ? id : '';
});
const relativeDeepest = computed(() => selected.value
  ? Math.max(1, ...nodes.value.map((node) => ancestors(node.id, nodes.value).indexOf(selected.value) + 1))
  : deepest.value + 1);

/** Путь от корня к выбранной группе; звено — ссылка на свой уровень. */
const trail = computed(() => {
  if (!selected.value) return [];
  const titles = new Map(nodes.value.map((node) => [node.id, node.title]));
  return [...ancestors(selected.value, nodes.value).reverse(), selected.value]
    .map((id) => ({ id, title: titles.get(id) ?? id }));
});

const depth = computed(() => {
  const wanted = String(route.query[depthKey.value] ?? '');
  return wanted === 'all' || /^[1-9]$/.test(wanted) ? wanted : '';
});
const levels = computed(() => [
  ...Array.from({ length: Math.min(9, relativeDeepest.value) }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
  { value: 'all', get label() { return t('t83.m2.all'); } }
]);
const canOpen = computed(() => !!selected.value && nodes.value.some((node) => node.parent === selected.value));
const opened = computed(() => String(route.query[openKey.value] ?? '') === selected.value && !!selected.value);

function change(query: Record<string, string | undefined>) {
  void router.push({ query: { ...route.query, ...query } });
}
const goGroup = (id: string | null) => change({ [groupKey.value]: id ?? undefined, [openKey.value]: undefined });
const setDepth = (value: string) => change({ [depthKey.value]: depth.value === value ? undefined : value, [openKey.value]: undefined });
const openInPlace = () => change({ [openKey.value]: opened.value ? undefined : selected.value });
const standardDepth = computed(() => depth.value === 'all' ||
  (!depth.value && route.query[props.kind === 'functional' ? 'capview' : 'view'] === 'all')
  ? relativeDeepest.value : Math.min(relativeDeepest.value, Number(depth.value) || 1));
function standardGroup(id?: string) {
  change({ [groupKey.value]: id, [openKey.value]: undefined, [depthKey.value]: undefined,
    [props.kind === 'functional' ? 'capview' : 'view']: undefined });
}
</script>

<template>
  <MapGraphNavigation v-if="standard" :title="mapTitle" :trail="trail" :max-depth="relativeDeepest" :depth="standardDepth"
    @enter="standardGroup" @update:depth="change({ [depthKey]: $event === relativeDeepest ? 'all' : String($event), [openKey]: undefined })" />
  <Teleport v-else :to="fullscreenTarget ?? 'body'" :disabled="!fullscreenTarget">
  <div class="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
    <nav class="flex flex-wrap items-center gap-1" :aria-label="t('mapGraph.location')">
      <span class="text-muted">{{ t('mapGraph.location') }}</span>
      <UButton v-if="selected" size="xs" variant="link" color="neutral" @click="goGroup(null)">{{ mapTitle }}</UButton>
      <span v-else class="font-medium" aria-current="location">{{ mapTitle }}</span>
      <template v-for="(step, i) in trail" :key="step.id">
        <span class="text-muted">›</span>
        <UButton v-if="i < trail.length - 1" size="xs" variant="link" color="neutral" @click="goGroup(step.id)">
          {{ step.title }}
        </UButton>
        <span v-else class="font-medium" aria-current="location">{{ step.title }}</span>
      </template>
    </nav>
    <UBadge variant="subtle" color="neutral">{{ t('mapGraph.currentLevel', { n: trail.length + 1 }) }}</UBadge>
    <div v-if="relativeDeepest > 1" class="flex items-center gap-1">
      <span class="text-muted">{{ t('mapGraph.visibleLevels') }}</span>
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
      {{ t('t83.map-depth-bar.3') }}
    </UButton>
  </div>
  </Teleport>
</template>
