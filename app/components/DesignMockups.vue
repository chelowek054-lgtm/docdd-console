<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ScreenInventory } from '~~/server/lib/design-screens';
import type { ScreensReport } from '~~/server/utils/design-screens-service';

/**
 * Экраны из Claude Design (R-0106, docs/16-design-system.md): общий холст на тёмном
 * фоне — макеты экранов в ряд, масштаб колесом с Ctrl и кнопками, перетаскивание
 * мышью, «Вписать». Макет — в окне `sandbox` без `allow-same-origin`: его скрипты
 * не видят консоль.
 */
const props = defineProps<{ projectId: string; screens: ScreensReport }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

const WIDTHS = computed(() => props.screens.widths);
const THEMES = computed(() => props.screens.themes);
const width = ref(WIDTHS.value[0] ?? 375);
const theme = ref(THEMES.value[0] ?? 'light');
const withShots = ref(false);
const isDark = (name: string) => name === 'dark' || name.endsWith('-dark');
/** Высота кадра: телефон — как экран телефона, шире — как ноутбук. */
const height = computed(() => (width.value <= 480 ? 812 : width.value <= 1024 ? 1024 : 800));

const framed = computed(() => props.screens.screens.filter((screen) => screen.html));

/**
 * Настоящий размер макета — его присылает сам макет (сервер вставляет короткий
 * скрипт). Шире выбранной ширины — это доска экранов из Claude Design: кадр
 * растёт до её размера, а не режет её телефоном.
 */
const natural = reactive<Record<string, { w: number; h: number }>>({});
const BOARD_LIMIT = 12_000;
function onMessage(event: MessageEvent) {
  const data = event.data as { docddMockup?: unknown; w?: unknown; h?: unknown } | null;
  if (!data || typeof data.docddMockup !== 'string' || typeof data.w !== 'number' || typeof data.h !== 'number') return;
  if (!framed.value.some((screen) => screen.id === data.docddMockup)) return;
  natural[data.docddMockup] = { w: Math.min(BOARD_LIMIT, Math.round(data.w)), h: Math.min(BOARD_LIMIT, Math.round(data.h)) };
}
onMounted(() => window.addEventListener('message', onMessage));
onBeforeUnmount(() => window.removeEventListener('message', onMessage));
const isBoard = (screen: ScreenInventory) => (natural[screen.id]?.w ?? 0) > width.value + 40;
const sizeOf = (screen: ScreenInventory) => (isBoard(screen) ? { w: natural[screen.id]!.w, h: natural[screen.id]!.h } : { w: width.value, h: height.value });
const others = computed(() => props.screens.screens.filter((screen) => !screen.html));

function stateOf(screen: ScreenInventory): { label: string; color: 'neutral' | 'warning' | 'success' } {
  if (!screen.html) return { label: screen.mockup ? t('mk.png') : t('mk.none'), color: 'neutral' };
  return screen.html.status === 'approved' ? { label: t('mk.approved'), color: 'success' } : { label: t('mk.draft'), color: 'warning' };
}
const srcOf = (screen: ScreenInventory) => `/api/projects/${props.projectId}/design/mockups/${encodeURIComponent(screen.id)}/index.html?theme=${encodeURIComponent(theme.value)}&dark=${isDark(theme.value) ? 1 : 0}`;
const shotOf = (screen: ScreenInventory) => screen.shots.find((item) => item.width === width.value && item.theme === theme.value && item.present) ?? null;

/* ---------- холст ---------- */
const GAP = 64;
const viewport = ref<HTMLElement | null>(null);
const zoom = ref(0.5);
const pan = reactive({ x: 48, y: 72 });
const dragging = ref(false);
let last: { x: number; y: number } | null = null;

const frameWidthOf = (screen: ScreenInventory) => sizeOf(screen).w + (withShots.value && !isBoard(screen) ? width.value + 24 : 0);
const contentWidth = computed(() => Math.max(1, framed.value.reduce((sum, screen) => sum + frameWidthOf(screen), 0) + GAP * (framed.value.length - 1)));
const contentHeight = computed(() => Math.max(height.value, ...framed.value.map((screen) => sizeOf(screen).h)) + 48);

function setZoom(next: number, at?: { x: number; y: number }) {
  const clamped = Math.min(2, Math.max(0.1, Math.round(next * 100) / 100));
  // Масштаб вокруг точки под курсором: то, на что смотрят, не уезжает.
  const point = at ?? { x: (viewport.value?.clientWidth ?? 0) / 2, y: (viewport.value?.clientHeight ?? 0) / 2 };
  pan.x = point.x - ((point.x - pan.x) * clamped) / zoom.value;
  pan.y = point.y - ((point.y - pan.y) * clamped) / zoom.value;
  zoom.value = clamped;
}

function fit() {
  const box = viewport.value;
  if (!box) return;
  const next = Math.min(1, (box.clientWidth - 96) / contentWidth.value, (box.clientHeight - 96) / contentHeight.value);
  zoom.value = Math.max(0.1, Math.round(next * 100) / 100);
  pan.x = (box.clientWidth - contentWidth.value * zoom.value) / 2;
  pan.y = 48;
}

/** Показать кадр в натуральную величину: масштаб 100 %, кадр — у левого края. */
function focus(index: number) {
  zoom.value = 1;
  pan.x = 48 - framed.value.slice(0, index).reduce((sum, screen) => sum + frameWidthOf(screen) + GAP, 0);
  pan.y = 48;
}

function onWheel(event: WheelEvent) {
  const box = viewport.value?.getBoundingClientRect();
  if (!box) return;
  if (event.ctrlKey || event.metaKey) {
    setZoom(zoom.value * (event.deltaY < 0 ? 1.1 : 1 / 1.1), { x: event.clientX - box.left, y: event.clientY - box.top });
  } else {
    pan.x -= event.shiftKey ? event.deltaY : event.deltaX;
    pan.y -= event.shiftKey ? 0 : event.deltaY;
  }
}

function onDown(event: PointerEvent) {
  if (event.button !== 0 && event.button !== 1) return;
  dragging.value = true;
  touched = true;
  last = { x: event.clientX, y: event.clientY };
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
}
function onMove(event: PointerEvent) {
  if (!dragging.value || !last) return;
  pan.x += event.clientX - last.x;
  pan.y += event.clientY - last.y;
  last = { x: event.clientX, y: event.clientY };
}
function onUp() {
  dragging.value = false;
  last = null;
}

onMounted(() => nextTick(fit));
watch([width, withShots, () => framed.value.length], () => nextTick(fit));
// Доска прислала размер — вписываем заново, пока человек сам не двигал холст.
let touched = false;
watch(() => JSON.stringify(natural), () => { if (!touched) nextTick(fit); });

/* ---------- импорт ---------- */
const adding = ref(false);
const screenId = ref('');
const file = ref<File | null>(null);
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);
const mapScreens = computed(() => props.screens.screens.map((screen) => ({ label: `${screen.title} · ${screen.id}`, value: screen.id })));

function pick(event: Event) {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}

async function upload() {
  if (!file.value || !screenId.value.trim()) return;
  busy.value = true;
  failure.value = null;
  try {
    const bytes = new Uint8Array(await file.value.arrayBuffer());
    let binary = '';
    for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000));
    const response = await $fetch(`/api/projects/${props.projectId}/design/mockups`, {
      method: 'POST',
      body: { screen: screenId.value.trim(), name: file.value.name, content: btoa(binary) },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) { failure.value = problem; return; }
    adding.value = false;
    file.value = null;
    emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="space-y-3">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="font-medium">{{ t('mk.title') }}</h2>
      <p class="text-sm text-muted">{{ t('mk.hint') }}</p>
      <UButton v-can="'edit_draft'" class="ml-auto" size="sm" icon="i-lucide-file-plus-2" @click="adding = !adding">{{ t('mk.add') }}</UButton>
    </div>

    <div v-if="adding" class="flex flex-wrap items-end gap-3 rounded-md border border-default p-3">
      <UFormField :label="t('mk.screen')" :hint="t('mk.screenHint')">
        <UInput v-model="screenId" list="mockup-screens" class="w-64" placeholder="login" />
        <datalist id="mockup-screens"><option v-for="item in mapScreens" :key="item.value" :value="item.value">{{ item.label }}</option></datalist>
      </UFormField>
      <UFormField :label="t('mk.file')" :hint="t('mk.fileHint')">
        <input type="file" accept=".html,.htm,.zip" class="text-sm" @change="pick">
      </UFormField>
      <UButton :loading="busy" :disabled="!file || !screenId.trim()" @click="upload">{{ t('mk.upload') }}</UButton>
      <p v-if="failure" class="w-full text-sm text-error">{{ failure.message }}</p>
    </div>

    <div v-if="framed.length" class="overflow-hidden rounded-lg border border-default">
      <!-- Панель холста: масштаб, ширина, тема, реализация рядом. -->
      <div class="flex flex-wrap items-center gap-2 border-b border-default bg-elevated/60 px-3 py-2 text-sm">
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-minus" :aria-label="t('mk.zoomOut')" @click="setZoom(zoom / 1.25)" />
        <span class="w-12 text-center tabular-nums">{{ Math.round(zoom * 100) }}%</span>
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-plus" :aria-label="t('mk.zoomIn')" @click="setZoom(zoom * 1.25)" />
        <UButton size="xs" color="neutral" variant="ghost" icon="i-lucide-scan" @click="fit">{{ t('mk.fit') }}</UButton>
        <UButton size="xs" color="neutral" variant="ghost" @click="setZoom(1)">100%</UButton>
        <span class="ml-auto text-muted">{{ t('mk.width') }}</span>
        <UButton v-for="item in WIDTHS" :key="item" size="xs" color="neutral" :variant="width === item ? 'solid' : 'ghost'" @click="width = item">{{ item }}</UButton>
        <span class="text-muted">{{ t('mk.theme') }}</span>
        <UButton v-for="item in THEMES" :key="item" size="xs" color="neutral" :variant="theme === item ? 'solid' : 'ghost'" @click="theme = item">{{ item }}</UButton>
        <UCheckbox v-model="withShots" :label="t('mk.withShots')" />
      </div>

      <!-- Холст: тёмный фон всегда — экраны на нём читаются лучше в любой теме консоли. -->
      <div
        ref="viewport"
        class="relative h-[70vh] min-h-[28rem] touch-none select-none overflow-hidden bg-[#1e1e1e]"
        :class="dragging ? 'cursor-grabbing' : 'cursor-grab'"
        :style="{ backgroundImage: 'radial-gradient(#2c2c2c 1px, transparent 1px)', backgroundSize: `${24 * zoom}px ${24 * zoom}px`, backgroundPosition: `${pan.x}px ${pan.y}px` }"
        @wheel.prevent="onWheel"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
      >
        <div class="absolute left-0 top-0 origin-top-left" :style="{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }">
          <div class="flex items-start" :style="{ gap: `${GAP}px` }">
            <div v-for="(screen, index) in framed" :key="screen.id" class="shrink-0" :style="{ width: `${frameWidthOf(screen)}px` }">
              <div class="mb-3 flex items-center gap-2 text-white/80" :style="{ fontSize: `${Math.max(14, 14 / zoom)}px` }">
                <span class="truncate">{{ index + 1 }} · {{ screen.title }}</span>
                <span v-if="isBoard(screen)" class="rounded bg-white/10 px-1.5 text-[0.75em] text-white/70">{{ t('mk.board') }}</span>
                <span class="rounded px-1.5 text-[0.75em]" :class="screen.html?.status === 'approved' ? 'bg-green-500/20 text-green-300' : 'bg-amber-500/20 text-amber-300'">{{ stateOf(screen).label }}</span>
                <button type="button" class="ml-auto text-white/60 hover:text-white" :title="t('mk.focus')" @pointerdown.stop @click="focus(index)">⤢</button>
              </div>
              <div class="flex gap-6">
                <!-- Пока тянут холст, окна не перехватывают мышь. -->
                <iframe
                  :key="srcOf(screen)"
                  :src="srcOf(screen)"
                  sandbox="allow-scripts"
                  class="block rounded-md bg-white shadow-2xl shadow-black/60"
                  :class="dragging ? 'pointer-events-none' : ''"
                  :style="{ width: `${sizeOf(screen).w}px`, height: `${sizeOf(screen).h}px` }"
                  :title="screen.title"
                />
                <div v-if="withShots && !isBoard(screen)" class="shrink-0" :style="{ width: `${width}px` }">
                  <img v-if="shotOf(screen)" :src="`/api/projects/${projectId}/design/shot?path=${encodeURIComponent(shotOf(screen)!.path)}`" class="block w-full rounded-md shadow-2xl shadow-black/60" :alt="screen.title" draggable="false">
                  <div v-else class="flex items-center justify-center rounded-md border border-dashed border-white/20 p-6 text-center text-white/50" :style="{ height: `${height}px` }">{{ t('mk.noShot') }}</div>
                </div>
              </div>
              <NuxtLink :to="`/projects/${projectId}/records/${screen.html?.record}`" class="mt-2 inline-block font-mono text-white/50 hover:text-white" :style="{ fontSize: `${Math.max(12, 12 / zoom)}px` }" @pointerdown.stop>{{ screen.html?.record }}</NuxtLink>
            </div>
          </div>
        </div>
        <p class="pointer-events-none absolute bottom-2 left-3 text-xs text-white/40">{{ t('mk.canvasHint') }}</p>
      </div>
    </div>

    <p v-if="others.length" class="text-sm text-muted">
      {{ t('mk.without') }}
      <span v-for="screen in others" :key="screen.id" class="mr-2">{{ screen.title }} <LightBadge :color="stateOf(screen).color" variant="subtle">{{ stateOf(screen).label }}</LightBadge></span>
    </p>
  </section>
</template>
