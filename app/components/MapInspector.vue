<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

import type { ApiFailure } from '~/composables/useProjectIndex';
import { highlightCode, type CodeToken } from '~/utils/highlight';
import type { MapSelection } from '~/utils/map-mermaid';
import { RELATION_LABEL, RELATION_LABEL_IN, STATE_LABEL, type CapabilityState, type RelationKind } from '~~/server/lib/functional';
import type { EvidenceVerdict } from '~~/server/lib/maps';

/**
 * Клик по узлу или ребру карты открывает эту карточку сбоку — не уводя с
 * диаграммы (docs/04-ui.md, «Карты»). У узла: что модуль делает (`summary`
 * карты), его публичный интерфейс (`api` карты) и содержимое файла — тем же
 * `GET /file`, что и ссылка из тела записи, с подсветкой синтаксиса. У ребра:
 * свидетельство и файл, прокрученный к нужной строке.
 */

const props = defineProps<{
  projectId: string;
  selection: MapSelection | null;
  /**
   * Куда телепортировать карточку. В обычном режиме — в `<body>` (по
   * умолчанию), а когда диаграмма развёрнута на весь экран — в тот же
   * контейнер, иначе Fullscreen API карточку не покажет (она вне поддерева
   * полноэкранного элемента).
   */
  to?: HTMLElement | null;
}>();
const emit = defineEmits<{
  close: [];
  /** «Связать» у возможности: форма живёт в дереве, карточка только просит её открыть. */
  relate: [id: string];
  /** «Убрать связь»: черновик заводит дерево, как и всякую правку функциональной карты. */
  unrelate: [relation: { from: string; to: string; kind: RelationKind }];
}>();

const open = computed({
  get: () => props.selection !== null,
  set: (value: boolean) => { if (!value) emit('close'); }
});

/** В узкой колонке код не читается — на весь экран по кнопке в шапке. */
const wide = ref(false);
/** Перенос длинных строк кода — чтобы не гонять горизонтальный скроллбар. */
const wrap = ref(false);

const STATUS_LABEL: Record<EvidenceVerdict, string> = {
  ok: 'сходится с файлом',
  stale: 'не сходится: строка уехала или текста больше нет',
  missing: 'файла нет',
  still_present: 'заявлено убранным, а текст на месте',
  pending: 'сверка не запущена: карта ещё не устоялась'
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
  if (sel.kind === 'relation' || sel.kind === 'group-link') return null;
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

/**
 * Строки кода с подсветкой. Пока Shiki грузится — показываем текст без цвета:
 * увидеть код важнее, чем ждать раскраску.
 */
const highlighted = ref<CodeToken[][]>([]);
const plainLines = computed<CodeToken[][]>(() =>
  (file.value?.content.split(/\r?\n/) ?? []).map((line) => [{ content: line }])
);
const codeLines = computed(() => (highlighted.value.length ? highlighted.value : plainLines.value));

// Смена темы пересчитывает подсветку: иначе код остался бы раскрашен в старой
// (docs/04-ui.md, «Тема»).
const colorMode = useColorMode();

watch([() => file.value?.content, path, () => colorMode.value], async () => {
  highlighted.value = [];
  const content = file.value?.content;
  if (!content) return;
  const dark = import.meta.client && colorMode.value === 'dark';
  highlighted.value = await highlightCode(content, path.value ?? '', dark);
});

const lineRefs = ref<Record<number, HTMLElement>>({});

watch([codeLines, highlightLine], async () => {
  if (highlightLine.value === null) return;
  await nextTick();
  lineRefs.value[highlightLine.value]?.scrollIntoView({ block: 'center' });
});

function setLineRef(el: Element | ComponentPublicInstance | null, line: number) {
  if (el instanceof HTMLElement) lineRefs.value[line] = el;
}

function tokenStyle(token: CodeToken) {
  return {
    color: token.color,
    fontStyle: token.italic ? 'italic' : undefined,
    fontWeight: token.bold ? '600' : undefined
  };
}

const capabilityState = computed<CapabilityState>(
  () => (props.selection?.kind === 'node' ? props.selection.status : undefined) ?? 'unassessed'
);
const nodeApi = computed(() => (props.selection?.kind === 'node' ? props.selection.api ?? [] : []));
const nodeSummary = computed(() => (props.selection?.kind === 'node' ? props.selection.summary : undefined));
</script>

<template>
  <!-- Слой задан явно: у темы его нет, а у кнопок диаграммы (MermaidDiagram.vue) стоит
       z-10 — без z-50 они вылезали поверх карточки, особенно в полноэкранном режиме,
       где карточка живёт внутри того же контейнера (docs/04-ui.md, «Карты»). -->
  <USlideover
    v-model:open="open"
    :portal="to ?? true"
    :ui="{ overlay: 'z-50', content: `z-50 ${wide ? 'max-w-[96vw]' : 'max-w-xl'}` }"
  >
    <template #header>
      <div v-if="selection" class="flex w-full items-start gap-2">
        <div class="min-w-0 flex-1">
          <h2 v-if="selection.kind === 'node'" class="truncate font-medium">{{ selection.title ?? selection.id }}</h2>
          <h2 v-else-if="selection.kind === 'relation'" class="font-medium">Связь между возможностями</h2>
          <h2 v-else-if="selection.kind === 'group-link'" class="font-medium">Связь между группами</h2>
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
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          title="Закрыть"
          @click="open = false"
        />
      </div>
    </template>

    <template #body>
      <div v-if="selection" class="space-y-4 text-sm">
        <div v-if="selection.kind === 'node'" class="space-y-1">
          <p class="font-mono text-xs text-muted">{{ selection.id }}</p>
        </div>

        <!-- Свёрнутая стрелка между группами: раскрытие — исходные импорты, каждый со свидетельством. -->
        <div v-if="selection.kind === 'group-link'" class="space-y-2">
          <p class="leading-relaxed">
            <strong>{{ selection.fromTitle }}</strong> → <strong>{{ selection.toTitle }}</strong>:
            {{ plural(selection.count, 'импорт', 'импорта', 'импортов') }}
          </p>
          <p v-if="selection.summary" class="text-muted">{{ selection.summary }}</p>
          <div class="flex flex-wrap gap-2">
            <UBadge :color="selection.status === 'ok' ? 'success' : selection.status === 'pending' ? 'neutral' : 'error'" variant="subtle">
              {{ STATUS_LABEL[selection.status] }}
            </UBadge>
            <UBadge v-if="selection.cycle" color="warning" variant="subtle" icon="i-lucide-refresh-cw">
              цикл между группами
            </UBadge>
          </div>
          <ul class="space-y-2">
            <li v-for="item in selection.imports" :key="item.from + item.to" class="rounded border border-default p-2">
              <p class="break-all font-mono text-xs">{{ item.from }} → {{ item.to }}</p>
              <p class="mt-1 font-mono text-xs text-muted">{{ item.evidence.path }}:{{ item.evidence.line }}</p>
              <pre class="mt-1 overflow-x-auto rounded bg-elevated p-1.5 text-xs">{{ item.evidence.fragment }}</pre>
              <UBadge
                v-if="item.status"
                class="mt-1"
                size="xs"
                :color="item.status === 'ok' ? 'success' : item.status === 'pending' ? 'neutral' : 'error'"
                variant="subtle"
              >
                {{ STATUS_LABEL[item.status] }}
              </UBadge>
            </li>
          </ul>
        </div>

        <!-- Связь возможностей: свидетельства нет вовсе, только смысл (docs/07-maps.md). -->
        <div v-if="selection.kind === 'relation'" class="space-y-2">
          <p class="leading-relaxed">
            <strong>{{ selection.fromTitle ?? selection.fromId }}</strong>
            {{ RELATION_LABEL[selection.relationKind] }}
            <strong>{{ selection.toTitle ?? selection.toId }}</strong>
          </p>
          <p v-if="selection.summary" class="text-muted">{{ selection.summary }}</p>
          <UBadge v-if="selection.cycle" color="error" variant="subtle" icon="i-lucide-refresh-cw">
            зависимость по кругу — не реализуется ни в каком порядке
          </UBadge>
          <UBadge v-if="selection.pending" color="neutral" variant="subtle">
            не совпадает с кодовой базой — карта ещё не устоялась
          </UBadge>
          <div>
            <UButton
              size="xs"
              color="neutral"
              variant="soft"
              icon="i-lucide-unlink"
              @click="emit('unrelate', { from: selection.fromId, to: selection.toId, kind: selection.relationKind })"
            >
              Убрать связь
            </UButton>
          </div>
        </div>

        <div v-if="selection.kind === 'edge'" class="space-y-1">
          <p class="font-mono text-xs">{{ selection.evidence.path }}:{{ selection.evidence.line }}</p>
          <pre class="overflow-x-auto rounded bg-elevated p-2 text-xs">{{ selection.evidence.fragment }}</pre>
          <UBadge
            v-if="selection.status"
            :color="selection.status === 'ok' ? 'success' : selection.status === 'pending' ? 'neutral' : 'error'"
            variant="subtle"
          >
            {{ STATUS_LABEL[selection.status] }}
          </UBadge>
        </div>

        <!-- Группа: что в ней, что она отдаёт наружу и с кем связана (docs/04-ui.md, «Группы кодовой карты»). -->
        <div v-if="selection.kind === 'node' && selection.group" class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <UBadge v-if="selection.group.auto" color="neutral" variant="subtle" size="sm">
              автогруппа — посчитана по пути
            </UBadge>
            <span class="text-muted">{{ plural(selection.group.modules, 'модуль', 'модуля', 'модулей') }}</span>
          </div>
          <p v-if="selection.group.summary" class="leading-relaxed">{{ selection.group.summary }}</p>
          <p class="text-xs text-muted">
            Состав: поимённо — {{ selection.group.sources.named }}, по префиксу — {{ selection.group.sources.prefix }},
            по пути — {{ selection.group.sources.auto }}
          </p>
          <p v-if="selection.group.capability" class="text-sm">
            <span class="text-muted">Реализует возможность:</span>
            <strong class="ml-1">{{ selection.group.capability.title ?? selection.group.capability.id }}</strong>
          </p>
          <div v-if="selection.group.surface.length">
            <h3 class="font-medium">Публичная поверхность</h3>
            <p class="text-xs text-muted">Модули, которые импортируют снаружи.</p>
            <ul class="mt-1 space-y-0.5">
              <li v-for="item in selection.group.surface" :key="item.id" class="font-mono text-xs">{{ item.title ?? item.id }}</li>
            </ul>
          </div>
          <div v-if="selection.group.links.length">
            <h3 class="font-medium">Связи с группами</h3>
            <ul class="mt-1 space-y-1">
              <li v-for="link in selection.group.links" :key="link.direction + link.other" class="flex flex-wrap items-center gap-2">
                <span class="text-muted">{{ link.direction === 'out' ? '→' : '←' }}</span>
                <strong>{{ link.otherTitle }}</strong>
                <span class="text-xs text-muted">{{ plural(link.count, 'импорт', 'импорта', 'импортов') }}</span>
                <UBadge v-if="link.status !== 'ok' && link.status !== 'pending'" size="xs" color="error" variant="subtle">не сходится</UBadge>
                <UBadge v-if="link.cycle" size="xs" color="warning" variant="subtle">цикл</UBadge>
              </li>
            </ul>
          </div>
        </div>

        <UBadge v-if="selection.kind === 'node' && selection.ghostOf" color="neutral" variant="outline">
          из группы {{ selection.ghostOf }}
        </UBadge>
        <UBadge v-if="selection.kind === 'node' && selection.port" color="neutral" variant="subtle">
          порт группы — у модуля есть связи с другими группами
        </UBadge>

        <UBadge v-if="selection.kind === 'node' && selection.pending" color="neutral" variant="subtle">
          не совпадает с кодовой базой — карта ещё не устоялась
        </UBadge>

        <p v-if="selection.declaredBy" class="text-xs text-muted">
          Объявлено картой
          <NuxtLink :to="`/projects/${projectId}/records/${selection.declaredBy}`" class="hover:underline">
            {{ selection.declaredBy }}
          </NuxtLink>
        </p>

        <!-- Состояние реализации — только у возможности функциональной карты. У родителя
             оно расчётное, и счёт нижних приходит вместе с ним (`progress`). -->
        <div v-if="selection.kind === 'node' && selection.capability" class="space-y-1">
          <UBadge :color="STATE_UI[capabilityState].color" variant="subtle" :icon="STATE_UI[capabilityState].icon">
            {{ STATE_LABEL[capabilityState] }}
          </UBadge>
          <p v-if="selection.progress" class="text-xs text-muted">{{ selection.progress }}</p>
          <p v-if="selection.note" class="leading-relaxed">{{ selection.note }}</p>
          <!-- Подсказки считаются из связей и состояния, нигде не хранятся (docs/07-maps.md). -->
          <UBadge v-if="selection.waitsFor?.length" color="warning" variant="subtle" icon="i-lucide-hourglass">
            ждёт: {{ selection.waitsFor.join(', ') }}
          </UBadge>
          <UBadge v-if="selection.inCycle" color="error" variant="subtle" icon="i-lucide-refresh-cw">
            зависит по кругу
          </UBadge>
        </div>

        <!-- Связи возможности: входящие и исходящие, с видом и подписью. Правит их дерево. -->
        <div v-if="selection.kind === 'node' && selection.capability" class="space-y-2">
          <div class="flex items-center gap-2">
            <h3 class="font-medium">Связи</h3>
            <UButton
              class="ml-auto"
              size="xs"
              variant="soft"
              color="neutral"
              icon="i-lucide-link"
              @click="emit('relate', selection.id)"
            >
              Связать
            </UButton>
          </div>
          <p v-if="!selection.relations?.length" class="text-muted">Связей нет.</p>
          <ul v-else class="space-y-1">
            <li
              v-for="relation in selection.relations"
              :key="relation.direction + relation.kind + relation.other"
              class="flex flex-wrap items-baseline gap-x-2 rounded border border-default p-2"
            >
              <span class="text-xs text-muted">{{ relation.direction === 'out' ? '→' : '←' }}</span>
              <template v-if="relation.direction === 'out'">
                <span class="text-xs">{{ RELATION_LABEL[relation.kind] }}</span>
                <strong>{{ relation.otherTitle ?? relation.other }}</strong>
              </template>
              <template v-else>
                <strong>{{ relation.otherTitle ?? relation.other }}</strong>
                <span class="text-xs">{{ RELATION_LABEL_IN[relation.kind] }}</span>
              </template>
              <span v-if="relation.summary" class="w-full text-xs text-muted">{{ relation.summary }}</span>
              <UButton
                class="ml-auto"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-unlink"
                title="Убрать связь"
                @click="emit('unrelate', relation.direction === 'out'
                  ? { from: selection.id, to: relation.other, kind: relation.kind }
                  : { from: relation.other, to: selection.id, kind: relation.kind })"
              />
            </li>
          </ul>
        </div>

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
          <div class="flex items-center gap-2">
            <h3 class="font-medium">Файл</h3>
            <UButton
              v-if="file"
              class="ml-auto"
              :icon="wrap ? 'i-lucide-move-horizontal' : 'i-lucide-wrap-text'"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="wrap ? 'Не переносить строки' : 'Переносить длинные строки'"
              @click="wrap = !wrap"
            />
          </div>
          <p class="font-mono text-xs text-muted">{{ path }}</p>

          <p v-if="loadingFile" class="text-muted">Открываю…</p>
          <UAlert
            v-else-if="fileFailure"
            color="warning"
            variant="subtle"
            :title="fileFailure.message"
          />
          <div
            v-else-if="file"
            class="overflow-auto rounded border border-default"
            :class="wide ? 'max-h-[calc(100vh-16rem)]' : 'max-h-[70vh]'"
          >
            <pre class="text-xs leading-5"><div
              v-for="(tokens, index) in codeLines"
              :key="index"
              :ref="(el) => setLineRef(el, index + 1)"
              class="flex px-2"
              :class="highlightLine === index + 1 ? 'bg-warning/20' : ''"
            ><span class="w-10 shrink-0 select-none text-right text-dimmed">{{ index + 1 }}</span><span
              class="pl-3"
              :class="wrap ? 'whitespace-pre-wrap break-words' : 'whitespace-pre'"
            ><span
              v-for="(token, ti) in tokens"
              :key="ti"
              :style="tokenStyle(token)"
            >{{ token.content }}</span><span v-if="!tokens.length">&#8203;</span></span></div></pre>
          </div>
        </template>

        <p
          v-if="!path && !nodeSummary && !nodeApi.length && selection.kind === 'node' && selection.capability"
          class="text-muted"
        >
          У этой возможности пока нет описания. Его добавляют кнопкой «Переименовать»
          в режиме «Дерево» — вместе с названием откроется поле описания.
        </p>
        <p
          v-else-if="!path && !nodeSummary && !nodeApi.length && selection.kind === 'node' && !selection.group"
          class="text-muted"
        >
          Карта пока не описала этот узел — ни что он делает, ни его интерфейс, ни файл.
          Это появится после «Обновить карты».
        </p>
      </div>
    </template>
  </USlideover>
</template>
