<script setup lang="ts">
import type { MermaidEdge } from '../utils/map-mermaid';

const props = defineProps<{
  source: string;
  id: string;
  /** id узла в тексте mermaid → полный текст для наведения (app/utils/map-mermaid.ts). */
  details?: Record<string, string>;
  /** id узла → файл, который открывает клик (только у узлов, которые карта назвала). */
  paths?: Record<string, string>;
  /** Свидетельство каждой связи — для клика по ребру. */
  edges?: MermaidEdge[];
  /** id узла → id соседей — для подсветки при клике (app/utils/map-mermaid.ts). */
  neighbors?: Record<string, string[]>;
}>();

const emit = defineEmits<{
  /** Клик по узлу — id узла (ключ в `details`/`paths`/`neighbors`). */
  'node-click': [id: string];
  'edge-click': [edge: MermaidEdge];
}>();

const wrapper = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const container = ref<HTMLElement | null>(null);
const error = ref('');
const fullscreen = ref(false);
/** Узел, на который кликнули последним — приглушает всё, кроме его соседей. */
const focused = ref<string | null>(null);
/** DOM-элемент ребра ↔ его данные — построено при отрисовке, используется и кликом, и приглушением. */
let edgeElements: { edge: MermaidEdge; el: SVGPathElement }[] = [];

/**
 * Отрисовка mermaid — только в браузере: библиотека меряет текст и без DOM не
 * работает. Ошибка разбора диаграммы — предупреждение у документа, а не отказ
 * его показать (docs/02-workspace-contract.md).
 */
async function draw() {
  if (!import.meta.client || !container.value) return;
  error.value = '';
  focused.value = null;
  edgeElements = [];
  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default',
      // Пересечений линий на плотном графе (десятки модулей, импорты крест-накрест)
      // меньше, если узлам и рангам просторнее — по умолчанию dagre экономит место
      // там, где для читаемости лучше не экономить.
      flowchart: { nodeSpacing: 60, rankSpacing: 90, curve: 'linear' }
    });
    const { svg } = await mermaid.render(`mermaid-${props.id}`, props.source);
    container.value.innerHTML = svg;
    annotateTitles();
    attachInteractions();
    resetView();
  } catch (cause) {
    container.value.innerHTML = '';
    error.value = cause instanceof Error ? cause.message.split('\n')[0] ?? '' : String(cause);
  }
}

onMounted(draw);
watch(() => props.source, draw);

/**
 * Ключ узла (как в `details`/`paths`) по элементу SVG. Mermaid называет узел
 * по нашему id с добавками (`flowchart-m_xxx-3`), поэтому ищем по вхождению,
 * а не по точному совпадению — тем же способом, каким искали для title.
 */
function keyOfNode(node: Element): string | null {
  const entries = Object.keys(props.details ?? {});
  return entries.find((key) => node.id.includes(`${key}-`) || node.id.endsWith(key)) ?? null;
}

/**
 * Подробности при наведении — родной `<title>` внутри узла SVG, без своей
 * всплывающей подсказки.
 */
function annotateTitles() {
  if (!container.value || !props.details) return;
  for (const node of container.value.querySelectorAll<SVGGElement>('.node, .mindmap-node')) {
    const key = keyOfNode(node);
    const text = key ? props.details[key] : undefined;
    if (!text) continue;
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = text;
    node.insertBefore(title, node.firstChild);
  }
}

/**
 * Клик по узлу и по ребру — «узел ведёт к коду, ребро — к свидетельству»
 * (docs/04-ui.md, «Карты»). Ребро ищем по id узлов внутри собственного id
 * ребра — mermaid кладёт оба id туда сам (`L_<from>_<to>_<n>`), тем же
 * приёмом вхождения, что и у узла; `dataset.claimed` бережёт от повторной
 * привязки одного DOM-элемента, если между теми же узлами несколько связей.
 */
function attachInteractions() {
  if (!container.value) return;

  for (const node of container.value.querySelectorAll<SVGGElement>('.node, .mindmap-node')) {
    const key = keyOfNode(node);
    if (!key) continue;
    (node.style as CSSStyleDeclaration).cursor = 'pointer';
    node.addEventListener('click', (event) => {
      event.stopPropagation();
      onNodeClick(key);
    });
  }

  for (const edge of props.edges ?? []) {
    const marker = `L_${edge.from}_${edge.to}_`;
    const path = [...container.value.querySelectorAll<SVGPathElement>('.edgePaths path')]
      .find((candidate) => candidate.id.includes(marker) && !candidate.dataset['claimed']);
    if (!path) continue;
    path.dataset['claimed'] = '1';
    path.style.cursor = 'pointer';
    path.style.pointerEvents = 'stroke';
    path.addEventListener('click', (event) => {
      event.stopPropagation();
      emit('edge-click', edge);
    });
    edgeElements.push({ edge, el: path });
  }

  // Клик по пустому месту диаграммы снимает фокус — узлы/рёбра сами
  // останавливают всплытие, сюда доходит только клик мимо них.
  viewport.value?.addEventListener('click', () => {
    if (focused.value !== null) {
      focused.value = null;
      applyFocus();
    }
  });
}

function onNodeClick(key: string) {
  focused.value = focused.value === key ? null : key;
  applyFocus();
  emit('node-click', key);
}

/**
 * Фокус на соседях — приглушает всё остальное, не перерисовывая диаграмму:
 * плотный граф иначе не разглядеть, какая связь чья (docs/04-ui.md, «Карты»).
 */
function applyFocus() {
  if (!container.value) return;
  const active = focused.value;
  const keep = active ? new Set([active, ...(props.neighbors?.[active] ?? [])]) : null;

  for (const node of container.value.querySelectorAll<SVGGElement>('.node, .mindmap-node')) {
    const key = keyOfNode(node);
    node.style.opacity = !keep || (key !== null && keep.has(key)) ? '1' : '0.15';
  }
  for (const { edge, el } of edgeElements) {
    el.style.opacity = !active || edge.from === active || edge.to === active ? '1' : '0.15';
  }
}

/**
 * Зум и панорамирование — своими руками, без библиотеки: сдвиг и масштаб
 * лежат в CSS-трансформе одного div, mermaid его не касается вовсе.
 */
const scale = ref(1);
const x = ref(0);
const y = ref(0);
const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

function resetView() {
  scale.value = 1;
  x.value = 0;
  y.value = 0;
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

/**
 * Колесо мыши — зум; трекпад присылает то же событие с `deltaX` при
 * двухпальцевой прокрутке (панорамирование) и с `ctrlKey` при щипке (зум) —
 * различаем по нему, а не по устройству, которое браузер не называет.
 */
function onWheel(event: WheelEvent) {
  if (!viewport.value) return;
  event.preventDefault();

  if (event.ctrlKey) {
    const rect = viewport.value.getBoundingClientRect();
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const next = clampScale(scale.value * (event.deltaY < 0 ? 1.1 : 1 / 1.1));

    // Масштабируем от точки под курсором, а не от угла — иначе картинка
    // «убегает» при каждом шаге зума.
    x.value = cursorX - ((cursorX - x.value) / scale.value) * next;
    y.value = cursorY - ((cursorY - y.value) / scale.value) * next;
    scale.value = next;
    return;
  }

  x.value -= event.deltaX;
  y.value -= event.deltaY;
}

const dragging = ref(false);
let dragStartX = 0;
let dragStartY = 0;
let originX = 0;
let originY = 0;

function onPointerDown(event: PointerEvent) {
  dragging.value = true;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  originX = x.value;
  originY = y.value;
  (event.target as HTMLElement).setPointerCapture(event.pointerId);
}

function onPointerMove(event: PointerEvent) {
  if (!dragging.value) return;
  x.value = originX + (event.clientX - dragStartX);
  y.value = originY + (event.clientY - dragStartY);
}

function onPointerUp() {
  dragging.value = false;
}

function zoomBy(factor: number) {
  scale.value = clampScale(scale.value * factor);
}

async function toggleFullscreen() {
  if (!wrapper.value) return;
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  } else {
    await wrapper.value.requestFullscreen();
  }
}

function onFullscreenChange() {
  fullscreen.value = document.fullscreenElement === wrapper.value;
}

onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange));
onUnmounted(() => document.removeEventListener('fullscreenchange', onFullscreenChange));

/**
 * SVG уже лежит в DOM — экспорт это просто его сериализация в файл, без
 * похода на сервер и без второй библиотеки. Кладём в него фон явно: страница
 * может быть в тёмной теме, а сохранённый файл должен читаться и вне неё.
 */
function exportSvg() {
  const svg = container.value?.querySelector('svg');
  if (!svg) return;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.style.backgroundColor = document.documentElement.classList.contains('dark') ? '#111827' : '#FFFFFF';
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${props.id}.svg`;
  link.click();
  URL.revokeObjectURL(url);
}
</script>

<template>
  <div>
    <div
      ref="wrapper"
      class="relative overflow-hidden rounded border border-default"
      :class="fullscreen ? 'h-screen w-screen bg-default' : ''"
    >
      <div class="absolute right-2 top-2 z-10 flex gap-1">
        <UButton
          icon="i-lucide-zoom-in"
          size="xs"
          color="neutral"
          variant="subtle"
          title="Приблизить"
          @click="zoomBy(1.25)"
        />
        <UButton
          icon="i-lucide-zoom-out"
          size="xs"
          color="neutral"
          variant="subtle"
          title="Отдалить"
          @click="zoomBy(0.8)"
        />
        <UButton
          icon="i-lucide-locate-fixed"
          size="xs"
          color="neutral"
          variant="subtle"
          title="Сбросить вид"
          @click="resetView"
        />
        <UButton
          :icon="fullscreen ? 'i-lucide-minimize' : 'i-lucide-maximize'"
          size="xs"
          color="neutral"
          variant="subtle"
          :title="fullscreen ? 'Выйти из полного экрана' : 'На весь экран'"
          @click="toggleFullscreen"
        />
        <UButton
          icon="i-lucide-download"
          size="xs"
          color="neutral"
          variant="subtle"
          title="Сохранить как SVG"
          @click="exportSvg"
        />
      </div>
      <div
        ref="viewport"
        class="h-[70vh] cursor-grab touch-none select-none active:cursor-grabbing"
        :class="fullscreen ? 'h-full' : ''"
        @wheel="onWheel"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointerleave="onPointerUp"
      >
        <div
          ref="container"
          class="h-full w-full origin-top-left"
          :style="{ transform: `translate(${x}px, ${y}px) scale(${scale})` }"
        />
      </div>
    </div>
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Диаграмма не разобралась"
      :description="error"
    />
    <pre v-if="error" class="mt-2 overflow-x-auto rounded bg-elevated p-3 text-xs">{{ props.source }}</pre>
  </div>
</template>
