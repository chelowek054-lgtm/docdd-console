<script setup lang="ts">
import { colorOf, type MermaidEdge, type MermaidNode } from '../utils/map-mermaid';

/**
 * Тот же граф, что и `MermaidDiagram.vue`, но силовой раскладкой в 3D
 * (`3d-force-graph`, поверх three.js/WebGL) — режим обзора для плотных
 * картин, где слои и порядок ветвления не так важны, как сама связность
 * (docs/04-ui.md, «Карты»). Раскладка не детерминирована и не показывает
 * слои колонками, поэтому это переключатель поверх основного 2D-вида, а не
 * замена ему.
 */

const props = defineProps<{
  id: string;
  nodes: Record<string, MermaidNode>;
  edges: MermaidEdge[];
  hiddenIds?: Set<string>;
  fullscreenTarget?: HTMLElement | null;
}>();

const emit = defineEmits<{
  'node-click': [id: string];
  'edge-click': [edge: MermaidEdge];
}>();

const wrapper = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const fullscreen = ref(false);
const error = ref('');

// Библиотека без своих типов и без смысла тянуть её на сервер: граф живёт
// только в браузере, поэтому instance типизирован как unknown-объект с тем
// малым набором методов (chainable API), который здесь действительно нужен.
/* eslint-disable @typescript-eslint/no-explicit-any */
let graph: any = null;
let resizeObserver: ResizeObserver | null = null;

/**
 * Узел графа адресуется ключом из `nodes` (mermaid-безопасный id, тот же,
 * что у `edges[].from/to` и у `node-click` в 2D-диаграмме), а не полем
 * `node.id` — там лежит исходный id модуля из карты, в своей адресации
 * (`app/utils/map-mermaid.ts`). Спутать их — клик находит не тот узел молча.
 */
function graphData() {
  const hidden = props.hiddenIds;
  const entries = Object.entries(props.nodes).filter(([key]) => !hidden?.has(key));
  const visible = new Set(entries.map(([key]) => key));
  const links = props.edges
    .filter((edge) => visible.has(edge.from) && visible.has(edge.to))
    .map((edge) => ({ source: edge.from, target: edge.to, edge }));
  return { nodes: entries.map(([key, node]) => ({ id: key, node })), links };
}

function resize() {
  if (!graph || !viewport.value) return;
  graph.width(viewport.value.clientWidth).height(viewport.value.clientHeight);
}

async function init() {
  if (!import.meta.client || !viewport.value) return;
  error.value = '';
  try {
    const ForceGraph3D = (await import('3d-force-graph')).default;
    const dark = document.documentElement.classList.contains('dark');
    graph = new ForceGraph3D(viewport.value)
      .backgroundColor(dark ? '#111827' : '#FFFFFF')
      .nodeLabel((entry: any) => entry.node.title ?? entry.node.id)
      .nodeColor((entry: any) => colorOf(entry.node.layer ?? entry.node.id))
      .linkColor(() => (dark ? '#4B5563' : '#9CA3AF'))
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(1)
      .onNodeClick((entry: any) => emit('node-click', entry.id))
      .onLinkClick((entry: any) => emit('edge-click', entry.edge))
      .graphData(graphData());
    resize();
    resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport.value);
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause);
  }
}

onMounted(init);
onUnmounted(() => resizeObserver?.disconnect());

watch([() => props.nodes, () => props.edges, () => props.hiddenIds], () => {
  graph?.graphData(graphData());
});

async function toggleFullscreen() {
  const target = props.fullscreenTarget ?? wrapper.value;
  if (!target) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await target.requestFullscreen();
  }
}

function onFullscreenChange() {
  const active = document.fullscreenElement;
  fullscreen.value = !!active && (active === wrapper.value || active === props.fullscreenTarget);
  // Контейнер сменил размер вместе с полноэкранным режимом — на следующий тик.
  requestAnimationFrame(resize);
}

onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange));
onUnmounted(() => document.removeEventListener('fullscreenchange', onFullscreenChange));
/* eslint-enable @typescript-eslint/no-explicit-any */
</script>

<template>
  <div>
    <div
      ref="wrapper"
      class="relative overflow-hidden rounded border border-default"
      :class="fullscreen ? (fullscreenTarget ? 'h-[85vh]' : 'h-screen w-screen bg-default') : ''"
    >
      <div class="absolute right-2 top-2 z-10 flex gap-1">
        <UButton
          :icon="fullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
          size="xs"
          color="neutral"
          variant="subtle"
          :title="fullscreen ? 'Выйти из полного экрана' : 'На весь экран'"
          @click="toggleFullscreen"
        />
      </div>
      <p class="absolute bottom-2 left-2 z-10 text-xs text-muted">
        Перетаскивание вращает, колесо — масштаб, правая кнопка — панорама
      </p>
      <div ref="viewport" class="h-[70vh]" :class="fullscreen ? 'h-full' : ''" />
    </div>
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="3D-сцена не собралась"
      :description="error"
    />
  </div>
</template>
