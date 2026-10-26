<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ScreenInventory } from '~~/server/lib/design-screens';
import type { ScreensReport } from '~~/server/utils/design-screens-service';

/**
 * Экраны из Claude Design (R-0106, docs/16-design-system.md): список экранов карты
 * путей с состоянием HTML-макета, импорт файла и живой просмотр. Макет — в окне
 * `sandbox` без `allow-same-origin`: его скрипты не видят консоль.
 */
const props = defineProps<{ projectId: string; screens: ScreensReport }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

const WIDTHS = computed(() => props.screens.widths);
const THEMES = computed(() => props.screens.themes);
const width = ref(WIDTHS.value[WIDTHS.value.length - 1] ?? 1280);
const theme = ref(THEMES.value[0] ?? 'light');
const openId = ref<string | null>(props.screens.screens.find((screen) => screen.html)?.id ?? null);
const open = computed(() => props.screens.screens.find((screen) => screen.id === openId.value) ?? null);
const isDark = (name: string) => name === 'dark' || name.endsWith('-dark');

function stateOf(screen: ScreenInventory): { label: string; color: 'neutral' | 'warning' | 'success' } {
  if (!screen.html) return { label: screen.mockup ? t('mk.png') : t('mk.none'), color: 'neutral' };
  return screen.html.status === 'approved' ? { label: t('mk.approved'), color: 'success' } : { label: t('mk.draft'), color: 'warning' };
}

const src = computed(() => open.value?.html
  ? `/api/projects/${props.projectId}/design/mockups/${encodeURIComponent(open.value.id)}/index.html?theme=${encodeURIComponent(theme.value)}&dark=${isDark(theme.value) ? 1 : 0}`
  : '');
const shot = computed(() => open.value?.shots.find((item) => item.width === width.value && item.theme === theme.value && item.present) ?? null);

/* импорт */
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
    openId.value = screenId.value.trim();
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

    <ul class="flex flex-wrap gap-2">
      <li v-for="screen in screens.screens" :key="screen.id">
        <UButton size="xs" :variant="openId === screen.id ? 'solid' : 'soft'" color="neutral" :disabled="!screen.html" @click="openId = screen.id">
          {{ screen.title }}
          <LightBadge :color="stateOf(screen).color" variant="subtle" class="ml-1">{{ stateOf(screen).label }}</LightBadge>
        </UButton>
      </li>
    </ul>

    <div v-if="open?.html" class="space-y-2">
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <RecordLink :project-id="projectId" :record-id="open.html.record" />
        <span class="ml-auto text-muted">{{ t('mk.width') }}</span>
        <UButton v-for="item in WIDTHS" :key="item" size="xs" color="neutral" :variant="width === item ? 'solid' : 'ghost'" @click="width = item">{{ item }}</UButton>
        <span class="text-muted">{{ t('mk.theme') }}</span>
        <UButton v-for="item in THEMES" :key="item" size="xs" color="neutral" :variant="theme === item ? 'solid' : 'ghost'" @click="theme = item">{{ item }}</UButton>
      </div>
      <div class="flex gap-4 overflow-x-auto">
        <figure class="shrink-0">
          <figcaption class="mb-1 text-xs text-muted">{{ t('mk.mockup') }}</figcaption>
          <iframe :key="src" :src="src" sandbox="allow-scripts" :style="{ width: `${width}px` }" class="h-[42rem] rounded-md border border-default bg-white" :title="open.title" />
        </figure>
        <figure class="shrink-0">
          <figcaption class="mb-1 text-xs text-muted">{{ t('mk.shot') }}</figcaption>
          <img v-if="shot" :src="`/api/projects/${projectId}/design/shot?path=${encodeURIComponent(shot.path)}`" :style="{ width: `${width}px` }" class="rounded-md border border-default" :alt="open.title">
          <p v-else class="w-64 text-sm text-muted">{{ t('mk.noShot') }}</p>
        </figure>
      </div>
    </div>
  </section>
</template>
