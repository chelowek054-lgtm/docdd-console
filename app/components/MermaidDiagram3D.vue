<script setup lang="ts">
import { colorOf, type MermaidEdge, type MermaidNode } from '../utils/map-mermaid';

/**
 * Тот же граф, что и `MermaidDiagram.vue`, но силовой раскладкой в 3D
 * (`3d-force-graph`, поверх three.js/WebGL) — режим обзора для плотных
 * картин, где слои и порядок ветвления не так важны, как сама связность
 * (docs/04-ui.md, «Карты»). Раскладка не детерминирована и не показывает
 * слои колонками, поэтому это переключатель поверх основного 2D-вида, а не
 * замена ему.
 *
 * Узел — не точка, а подписанная сфера (`nodeThreeObject`): без подписи 3D
 * выглядело картинкой, а не картой — цвет по слою ничего не говорит, пока
 * не видно, какой слой каким цветом (легенда ниже решает то же самое).
 * Материал — `MeshBasicMaterial` (без реакции на свет): сфера по умолчанию
 * у библиотеки тускнеет без своего источника света, а цвет здесь несёт
 * смысл (слой), а не объём.
 */

const props = defineProps<{
  id: string;
  nodes: Record<string, MermaidNode>;
  edges: MermaidEdge[];
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

// Библиотеки без типов, живущие только в браузере (граф на сервер не едет),
// типизированы как unknown-объекты с тем малым набором chainable-методов,
// который здесь нужен — тянуть на сервер их незачем.
/* eslint-disable @typescript-eslint/no-explicit-any */
let graph: any = null;
let resizeObserver: ResizeObserver | null = null;
/** Автоподгонка вида — один раз при первой раскладке, не при каждом обновлении фильтра. */
let fitted = false;

/**
 * Узел графа адресуется ключом из `nodes` (mermaid-безопасный id, тот же,
 * что у `edges[].from/to` и у `node-click` в 2D-диаграмме), а не полем
 * `node.id` — там лежит исходный id модуля из карты, в своей адресации
 * (`app/utils/map-mermaid.ts`). Спутать их — клик находит не тот узел молча.
 */
function graphData() {
  const entries = Object.entries(props.nodes);
  const visible = new Set(entries.map(([key]) => key));
  const links = props.edges
    .filter((edge) => visible.has(edge.from) && visible.has(edge.to))
    .map((edge) => ({ source: edge.from, target: edge.to, edge }));

  // Число связей узла — сфера крупнее у более связного модуля: издалека
  // видно, что здесь узел архитектуры, а не проходная деталь.
  const degree = new Map<string, number>();
  for (const link of links) {
    degree.set(link.source, (degree.get(link.source) ?? 0) + 1);
    degree.set(link.target, (degree.get(link.target) ?? 0) + 1);
  }

  return {
    nodes: entries.map(([key, node]) => ({ id: key, node, degree: degree.get(key) ?? 0 })),
    links
  };
}

/** Цвет и подпись каждого встреченного слоя — то же соответствие, что красит сферы. */
const legend = computed(() => {
  const seen = new Set<string>();
  for (const node of Object.values(props.nodes)) {
    if (node.layer) seen.add(node.layer);
  }
  return [...seen].sort().map((layer) => ({ layer, color: colorOf(layer) }));
});

function resize() {
  if (!graph || !viewport.value) return;
  graph.width(viewport.value.clientWidth).height(viewport.value.clientHeight);
}

async function init() {
  if (!import.meta.client || !viewport.value) return;
  error.value = '';
  try {
    const [{ default: ForceGraph3D }, THREE, { default: SpriteText }] = await Promise.all([
      import('3d-force-graph'),
      import('three'),
      import('three-spritetext')
    ]);
    const dark = document.documentElement.classList.contains('dark');
    const linkBase = dark ? '#4B5563' : '#9CA3AF';

    graph = new ForceGraph3D(viewport.value)
      .backgroundColor(dark ? '#111827' : '#FFFFFF')
      .nodeLabel((entry: any) => entry.node.title ?? entry.node.id)
      .nodeThreeObject((entry: any) => {
        const group = new THREE.Group();
        const radius = 2.2 + Math.min(entry.degree, 12) * 0.5;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(radius, 12, 12),
          new THREE.MeshBasicMaterial({
            color: colorOf(entry.node.layer ?? entry.node.id),
            transparent: true,
            opacity: entry.node.pending ? 0.45 : 1
          })
        );
        group.add(mesh);

        const text = new SpriteText(entry.node.title ?? entry.node.id);
        text.textHeight = 3.2;
        text.color = dark ? '#E5E7EB' : '#1F2937';
        text.backgroundColor = dark ? 'rgba(17,24,39,0.7)' : 'rgba(255,255,255,0.7)';
        text.padding = 1;
        text.borderRadius = 1;
        text.position.set(0, radius + 3, 0);
        group.add(text);

        return group;
      })
      .linkColor(() => linkBase)
      .linkOpacity((entry: any) => (entry.edge?.pending ? 0.25 : 0.55))
      .linkDirectionalArrowLength(4)
      .linkDirectionalArrowRelPos(1)
      .onNodeClick((entry: any) => emit('node-click', entry.id))
      .onLinkClick((entry: any) => emit('edge-click', entry.edge))
      .onEngineStop(() => {
        if (fitted) return;
        fitted = true;
        graph.zoomToFit(400, 60);
      })
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

watch([() => props.nodes, () => props.edges], () => {
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
      <div v-if="legend.length" class="absolute left-2 top-2 z-10 flex max-w-[60%] flex-wrap gap-1">
        <span
          v-for="item in legend"
          :key="item.layer"
          class="flex items-center gap-1 rounded bg-default/80 px-1.5 py-0.5 text-xs text-muted"
        >
          <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: item.color }" />
          {{ item.layer }}
        </span>
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
