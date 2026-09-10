<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

import type { ApiFailure } from '~/composables/useProjectIndex';
import type { MapSelection } from '~/utils/map-mermaid';
import type { EvidenceVerdict } from '~~/server/lib/maps';

/**
 * Клик по узлу или ребру карты открывает эту карточку сбоку — не уводя с
 * диаграммы (docs/04-ui.md, «Карты»). У узла: что модуль делает (`summary`
 * карты), его публичный интерфейс (`api` карты) и содержимое файла — тем же
 * `GET /file`, что и ссылка из тела записи. У ребра: свидетельство и файл,
 * прокрученный к нужной строке.
 */

const props = defineProps<{
  projectId: string;
  selection: MapSelection | null;
}>();
const emit = defineEmits<{ close: [] }>();

const open = computed({
  get: () => props.selection !== null,
  set: (value: boolean) => { if (!value) emit('close'); }
});

/** В узкой колонке код не читается — на весь экран по кнопке в шапке. */
const wide = ref(false);

const STATUS_LABEL: Record<EvidenceVerdict, string> = {
  ok: 'сходится с файлом',
  stale: 'не сходится: строка уехала или текста больше нет',
  missing: 'файла нет',
  still_present: 'заявлено убранным, а текст на месте'
};

/**
 * Что за файл открывать. У ребра — путь свидетельства. У узла — `path`, а
 * если его нет, но сам `id` — путь к файлу (есть `/` и расширение), то `id`:
 * его написала модель, сервер подтвердит или честно откажет. Догадки из
 * dotted-имени не строятся (04-ui.md, «Карты»).
 */
const LOOKS_LIKE_PATH = /\/[^/]+\.[A-Za-z0-9]+$/;
const path = computed(() => {
  const sel = props.selection;
  if (!sel) return null;
  if (sel.kind === 'edge') return sel.evidence.path;
  if (sel.path) return sel.path;
  return LOOKS_LIKE_PATH.test(sel.id) ? sel.id : null;
});
const highlightLine = computed(() => (props.selection?.kind === 'edge' ? props.selection.evidence.line : null));

const file = ref<{ content: string; size: number } | null>(null);
const fileFailure = ref<ApiFailure | null>(null);
const loadingFile = ref(false);

watch([() => props.projectId, path], async ([projectId, filePath]) => {
  file.value = null;
  fileFailure.value = null;
  if (!filePath) return;
  loadingFile.value = true;
  try {
    const response = await $fetch(`/api/projects/${projectId}/file`, {
      query: { path: filePath },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      fileFailure.value = problem;
      return;
    }
    file.value = response as { content: string; size: number };
  } finally {
    loadingFile.value = false;
  }
}, { immediate: true });

const lines = computed(() => file.value?.content.split(/\r?\n/) ?? []);
const lineRefs = ref<Record<number, HTMLElement>>({});

watch([lines, highlightLine], async () => {
  if (highlightLine.value === null) return;
  await nextTick();
  lineRefs.value[highlightLine.value]?.scrollIntoView({ block: 'center' });
});

function setLineRef(el: Element | ComponentPublicInstance | null, line: number) {
  if (el instanceof HTMLElement) lineRefs.value[line] = el;
}

const nodeApi = computed(() => (props.selection?.kind === 'node' ? props.selection.api ?? [] : []));
const nodeSummary = computed(() => (props.selection?.kind === 'node' ? props.selection.summary : undefined));
</script>

<template>
  <USlideover v-model:open="open" :ui="{ content: wide ? 'max-w-[92vw]' : 'max-w-xl' }">
    <template #header>
      <div v-if="selection" class="flex w-full items-start gap-2">
        <div class="min-w-0 flex-1">
          <h2 v-if="selection.kind === 'node'" class="truncate font-medium">{{ selection.title ?? selection.id }}</h2>
          <h2 v-else class="font-medium">Свидетельство связи</h2>
          <p v-if="selection.kind === 'node' && selection.layer" class="text-sm text-muted">
            слой: {{ selection.layer }}
          </p>
        </div>
        <UButton
          :icon="wide ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
          size="xs"
          color="neutral"
          variant="ghost"
          :title="wide ? 'Свернуть' : 'Развернуть'"
          @click="wide = !wide"
        />
      </div>
    </template>

    <template #body>
      <div v-if="selection" class="space-y-4 text-sm">
        <div v-if="selection.kind === 'node'" class="space-y-1">
          <p class="font-mono text-xs text-muted">{{ selection.id }}</p>
        </div>

        <div v-if="selection.kind === 'edge'" class="space-y-1">
          <p class="font-mono text-xs">{{ selection.evidence.path }}:{{ selection.evidence.line }}</p>
          <pre class="overflow-x-auto rounded bg-elevated p-2 text-xs">{{ selection.evidence.fragment }}</pre>
          <UBadge
            v-if="selection.status"
            :color="selection.status === 'ok' ? 'success' : 'error'"
            variant="subtle"
          >
            {{ STATUS_LABEL[selection.status] }}
          </UBadge>
        </div>

        <p v-if="selection.declaredBy" class="text-xs text-muted">
          Объявлено картой
          <NuxtLink :to="`/projects/${projectId}/records/${selection.declaredBy}`" class="hover:underline">
            {{ selection.declaredBy }}
          </NuxtLink>
        </p>

        <p v-if="nodeSummary" class="leading-relaxed">{{ nodeSummary }}</p>

        <template v-if="nodeApi.length">
          <h3 class="font-medium">Интерфейс</h3>
          <ul class="space-y-2">
            <li v-for="item in nodeApi" :key="item.name" class="rounded border border-default p-2">
              <div class="flex flex-wrap items-baseline gap-2">
                <code class="text-xs font-semibold">{{ item.name }}</code>
                <UBadge v-if="item.kind" size="xs" color="neutral" variant="subtle">{{ item.kind }}</UBadge>
              </div>
              <p v-if="item.summary" class="mt-1 text-xs text-muted">{{ item.summary }}</p>
              <pre
                v-if="item.signature"
                class="mt-1 overflow-x-auto rounded bg-elevated p-1.5 text-xs"
              >{{ item.signature }}</pre>
            </li>
          </ul>
        </template>

        <template v-if="path">
          <h3 class="font-medium">Файл</h3>
          <p class="font-mono text-xs text-muted">{{ path }}</p>

          <p v-if="loadingFile" class="text-muted">Открываю…</p>
          <UAlert
            v-else-if="fileFailure"
            color="warning"
            variant="subtle"
            :title="fileFailure.message"
          />
          <div v-else-if="file" class="max-h-[70vh] overflow-auto rounded border border-default">
            <pre class="text-xs leading-5"><div
              v-for="(line, index) in lines"
              :key="index"
              :ref="(el) => setLineRef(el, index + 1)"
              class="flex px-2"
              :class="highlightLine === index + 1 ? 'bg-warning/20' : ''"
            ><span class="w-10 shrink-0 select-none text-right text-dimmed">{{ index + 1 }}</span><span class="pl-3 whitespace-pre">{{ line }}</span></div></pre>
          </div>
        </template>

        <p v-if="!path && !nodeSummary && !nodeApi.length && selection.kind === 'node'" class="text-muted">
          Карта пока не описала этот узел — ни что он делает, ни его интерфейс, ни файл.
          Это появится после «Обновить карты».
        </p>
      </div>
    </template>
  </USlideover>
</template>
