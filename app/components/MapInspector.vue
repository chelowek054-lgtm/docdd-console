<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

import type { ApiFailure } from '~/composables/useProjectIndex';
import type { MapSelection } from '~/utils/map-mermaid';
import type { EvidenceVerdict } from '~~/server/lib/maps';

/**
 * Клик по узлу или ребру карты открывает эту карточку сбоку — не уводя с
 * диаграммы (docs/04-ui.md, «Карты»). Узел ведёт к своему файлу через тот же
 * `GET /file`, что и ссылка из тела записи; ребро — к своему свидетельству, с
 * тем же файлом, прокрученным к нужной строке.
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

const STATUS_LABEL: Record<EvidenceVerdict, string> = {
  ok: 'сходится с файлом',
  stale: 'не сходится: строка уехала или текста больше нет',
  missing: 'файла нет',
  still_present: 'заявлено убранным, а текст на месте'
};

const path = computed(() => {
  const sel = props.selection;
  if (!sel) return null;
  return sel.kind === 'node' ? (sel.path ?? null) : sel.evidence.path;
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
</script>

<template>
  <USlideover v-model:open="open" :ui="{ content: 'max-w-xl' }">
    <template #header>
      <div v-if="selection">
        <h2 v-if="selection.kind === 'node'" class="font-medium">{{ selection.title ?? selection.id }}</h2>
        <h2 v-else class="font-medium">Свидетельство связи</h2>
        <p v-if="selection.kind === 'node' && selection.layer" class="text-sm text-muted">слой: {{ selection.layer }}</p>
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
          <div v-else-if="file" class="max-h-[60vh] overflow-auto rounded border border-default">
            <pre class="text-xs leading-5"><div
              v-for="(line, index) in lines"
              :key="index"
              :ref="(el) => setLineRef(el, index + 1)"
              class="flex px-2"
              :class="highlightLine === index + 1 ? 'bg-warning/20' : ''"
            ><span class="w-10 shrink-0 select-none text-right text-dimmed">{{ index + 1 }}</span><span class="pl-3 whitespace-pre">{{ line }}</span></div></pre>
          </div>
        </template>
        <p v-else-if="selection.kind === 'node'" class="text-muted">
          Карта не назвала файл этого узла — открыть нечего.
        </p>
      </div>
    </template>
  </USlideover>
</template>
