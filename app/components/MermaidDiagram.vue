<script setup lang="ts">
const props = defineProps<{
  source: string;
  id: string;
  /** id узла в тексте mermaid → полный текст для наведения (app/utils/map-mermaid.ts). */
  details?: Record<string, string>;
}>();

const wrapper = ref<HTMLElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const container = ref<HTMLElement | null>(null);
const error = ref('');
const fullscreen = ref(false);

/**
 * Отрисовка mermaid — только в браузере: библиотека меряет текст и без DOM не
 * работает. Ошибка разбора диаграммы — предупреждение у документа, а не отказ
 * его показать (docs/02-workspace-contract.md).
 */
async function draw() {
  if (!import.meta.client || !container.value) return;
  error.value = '';
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
    resetView();
  } catch (cause) {
    container.value.innerHTML = '';
    error.value = cause instanceof Error ? cause.message.split('\n')[0] ?? '' : String(cause);
  }
}

onMounted(draw);
watch(() => props.source, draw);

/**
 * Подробности при наведении — родной `<title>` внутри узла SVG, без своей
 * всплывающей подсказки: mermaid называет узел по нашему id с добавками
 * (`flowchart-m_xxx-3`), поэтому ищем по вхождению, а не по точному совпадению.
 */
function annotateTitles() {
  if (!container.value || !props.details) return;
  const entries = Object.entries(props.details);
  if (entries.length === 0) return;

  for (const node of container.value.querySelectorAll<SVGGElement>('.node, .mindmap-node')) {
    const match = entries.find(([key]) => node.id.includes(`${key}-`) || node.id.endsWith(key));
    if (!match?.[1]) continue;
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = match[1];
    node.insertBefore(title, node.firstChild);
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
