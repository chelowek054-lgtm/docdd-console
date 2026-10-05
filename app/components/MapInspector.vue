<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

import type { ApiFailure } from '~/composables/useProjectIndex';
import { highlightCode, type CodeToken } from '~/utils/highlight';
import { COVERAGE_LABEL, HORIZON_LABEL, PRIORITY_LABEL } from '../../server/lib/functional';
import { RISK_LABEL, STATUS_STYLE, statusText, type CapabilityLink } from '~/utils/functional-view';
import type { MapSelection } from '~/utils/map-mermaid';
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
  /** id → название возможности функциональной карты — для карточки группы. */
  capabilityTitles?: Record<string, string>;
  /** Влияние выбранной возможности включено на схеме. */
  impactOn?: boolean;
}>();
const emit = defineEmits<{
  close: [];
  /** «Открыть группу» — из карточки группы, призрака или связи (docs/04-ui.md, «Группы кодовой карты»). */
  'open-group': [groupId: string];
  /** «Открыть» у узла обзора потоков: группа кода или вид источников. */
  'open-flow': [target: { type: 'code' | 'kind'; id: string }];
  /** «Влияние» у возможности: подсветить цепочки «опирается на» и «на неё опираются». */
  impact: [];
  /** Убрать связь возможности — отложится в пачку связей, а не запишется сразу. */
  unrelate: [relation: { from: string; to: string; type: string }];
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
  if (sel.kind === 'group' || sel.kind === 'link') return null;
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

/**
 * Возможность функциональной карты: состояние, `note`, связи в обе стороны и
 * «ждёт» (docs/04-ui.md, «Функциональная карта»). Названия связей читаются от
 * лица самой возможности — «зависит от», а с другой стороны — «от неё зависит».
 */
const capView = computed(() => (props.selection?.kind === 'node' ? props.selection.capabilityView : undefined));
const capNote = computed(() => (props.selection?.kind === 'node' ? props.selection.note : undefined));
const BADGE_COLOR = { implemented: 'success', partial: 'warning', not_implemented: 'error', unrated: 'neutral' } as const;
const LINK_WORDS = {
  out: { depends: 'зависит от', uses: 'пользуется', feeds: 'передаёт данные в', triggers: 'запускает', replaces: 'заменяет' },
  in: { depends: 'от неё зависит', uses: 'ею пользуется', feeds: 'передаёт ей данные', triggers: 'её запускает', replaces: 'её заменяет' }
} as const;

function removeLink(link: CapabilityLink) {
  const self = props.selection?.kind === 'node' ? props.selection.id : '';
  emit('unrelate', link.direction === 'out'
    ? { from: self, to: link.id, type: link.type }
    : { from: link.id, to: self, type: link.type });
}
const titleOf = (id: string) => props.capabilityTitles?.[id] ?? id;
const capGroupOf = computed(() => (props.selection?.kind === 'node' ? props.selection.capabilityGroup : undefined));
const coverage = computed(() => capView.value?.coverage);
const waitingNames = computed(() => (capView.value?.waiting ?? []).map(
  (id) => capView.value?.links.find((link) => link.id === id)?.title ?? id
));

const flowGroupOf = computed(() => (props.selection?.kind === 'node' ? props.selection.flowGroup : undefined));
const ghostOf = computed(() => (props.selection?.kind === 'node' ? props.selection.ghost : undefined));
const groupOfNode = computed(() => (props.selection?.kind === 'node' ? props.selection.group : undefined));
const GROUP_STATUS_COLOR = { ok: 'success', pending: 'neutral' } as const;

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
          <h2 v-else-if="selection.kind === 'group'" class="truncate font-medium">{{ selection.title }}</h2>
          <h2 v-else-if="selection.kind === 'link'" class="font-medium">
            {{ selection.fromTitle }} → {{ selection.toTitle }}
          </h2>
          <h2 v-else class="font-medium">Свидетельство связи</h2>
          <p v-if="selection.kind === 'node' && selection.layer && !selection.group && !selection.flowGroup" class="text-sm text-muted">
            слой: {{ selection.layer }}
          </p>
          <p v-else-if="selection.kind === 'group'" class="text-sm text-muted">
            {{ selection.auto ? 'группа выведена из путей — «авто»' : 'группа объявлена картой' }}
          </p>
          <p v-else-if="selection.kind === 'link' && selection.direction" class="text-sm text-muted">
            {{ selection.fromTitle }} {{ selection.directionText }} {{ selection.toTitle }}:
            {{ plural(selection.imports.length, 'поток', 'потока', 'потоков') }}
          </p>
          <p v-else-if="selection.kind === 'link'" class="text-sm text-muted">
            {{ plural(selection.imports.length, 'импорт', 'импорта', 'импортов') }} между группами
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
          <p v-if="selection.arch" class="rounded border border-violet-400 bg-violet-50 p-2 text-xs text-violet-900 dark:bg-violet-950 dark:text-violet-200">
            <span class="font-semibold">Нарушение архитектуры.</span> {{ selection.arch.message }}
          </p>
        </div>

        <!-- Узел обзора потоков: группа кода или вид источников. -->
        <div v-if="flowGroupOf" class="space-y-2">
          <p v-if="flowGroupOf.type === 'kind'" class="leading-relaxed">
            Все источники этого вида и группы кода, что их трогают.
          </p>
          <p v-else-if="!groupOfNode" class="leading-relaxed">
            Группа кода без карточки в кодовой карте: экраны пользовательской карты или то,
            что карта не назвала модулем.
          </p>
          <UButton size="sm" icon="i-lucide-folder-open" @click="emit('open-flow', flowGroupOf)">Открыть</UButton>
        </div>

        <!-- Призрак: сосед выбранного модуля из другой группы — не часть открытой (docs/04-ui.md). -->
        <div v-if="ghostOf" class="flex flex-wrap items-center gap-2">
          <UBadge color="neutral" variant="outline">из группы {{ ghostOf.groupTitle }}</UBadge>
          <UButton size="xs" variant="soft" icon="i-lucide-folder-open" @click="emit('open-group', ghostOf.groupId)">
            Открыть группу
          </UButton>
        </div>

        <!-- Карточка группы -->
        <div v-if="selection.kind === 'group' || groupOfNode" class="space-y-3">
          <template v-for="card in [selection.kind === 'group' ? selection : groupOfNode]" :key="card?.groupId">
            <template v-if="card">
              <p v-if="card.summary" class="leading-relaxed">{{ card.summary }}</p>
              <p v-else-if="card.auto" class="text-muted">
                У группы нет описания: она выведена из путей. Описание появится, когда карта её объявит.
              </p>
              <p v-else class="text-muted">У группы нет описания: карта её объявила без поля `summary`.</p>
              <p v-if="card.capability" class="text-xs text-muted">
                Реализует возможность
                <template v-if="capabilityTitles?.[card.capability]">«{{ capabilityTitles[card.capability] }}»</template>
                <template v-else><span class="font-mono">{{ card.capability }}</span> — такой возможности нет</template>
              </p>
              <p v-if="card.declaredBy" class="text-xs text-muted">
                Объявлена картой
                <NuxtLink :to="`/projects/${projectId}/records/${card.declaredBy}`" class="hover:underline">
                  {{ card.declaredBy }}
                </NuxtLink>
              </p>

              <p>{{ plural(card.moduleCount, 'модуль', 'модуля', 'модулей') }}</p>
              <div class="flex flex-wrap gap-1">
                <UBadge v-for="item in card.layers" :key="item.layer" size="xs" color="neutral" variant="subtle">
                  {{ item.layer }} · {{ item.count }}
                </UBadge>
              </div>

              <UButton
                v-if="selection.kind === 'group'"
                size="sm"
                icon="i-lucide-folder-open"
                @click="emit('open-group', card.groupId)"
              >
                Открыть группу
              </UButton>

              <template v-if="card.surface.length">
                <h3 class="font-medium">Публичная поверхность</h3>
                <p class="text-xs text-muted">Модули, на которые ссылаются снаружи, и сколько групп.</p>
                <ul class="space-y-1">
                  <li v-for="item in card.surface" :key="item.id" class="text-xs">
                    <span class="font-mono">{{ item.title ?? item.id }}</span>
                    <span class="text-muted"> — {{ plural(item.importers, 'группа', 'группы', 'групп') }}</span>
                  </li>
                </ul>
              </template>

              <template v-if="card.dependsOn.length">
                <h3 class="font-medium">Зависит от</h3>
                <ul class="space-y-1">
                  <li v-for="item in card.dependsOn" :key="item.groupId" class="text-xs">
                    <button type="button" class="hover:underline" @click="emit('open-group', item.groupId)">{{ item.title }}</button>
                    <span class="text-muted"> — {{ plural(item.count, 'импорт', 'импорта', 'импортов') }}</span>
                  </li>
                </ul>
              </template>

              <template v-if="card.usedBy.length">
                <h3 class="font-medium">Используют</h3>
                <ul class="space-y-1">
                  <li v-for="item in card.usedBy" :key="item.groupId" class="text-xs">
                    <button type="button" class="hover:underline" @click="emit('open-group', item.groupId)">{{ item.title }}</button>
                    <span class="text-muted"> — {{ plural(item.count, 'импорт', 'импорта', 'импортов') }}</span>
                  </li>
                </ul>
              </template>
            </template>
          </template>
        </div>

        <!-- Связь между группами: исходные импорты со свидетельствами -->
        <div v-if="selection.kind === 'link'" class="space-y-3">
          <UBadge
            :color="GROUP_STATUS_COLOR[selection.status as 'ok' | 'pending'] ?? 'error'"
            variant="subtle"
          >
            {{ STATUS_LABEL[selection.status] }}
          </UBadge>
          <p v-if="selection.cycle" class="text-xs text-warning">
            Группы зависят друг от друга по кругу — это уровень выше модулей, где такой цикл не виден.
          </p>
          <ul class="space-y-2">
            <li v-for="item in selection.imports" :key="`${item.from}>${item.to}`" class="rounded border border-default p-2">
              <p class="font-mono text-xs">{{ item.from }} → {{ item.to }}</p>
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

        <UBadge v-if="selection.kind === 'node' && selection.pending" color="neutral" variant="subtle">
          не совпадает с кодовой базой — карта ещё не устоялась
        </UBadge>

        <p v-if="(selection.kind === 'node' || selection.kind === 'edge') && selection.declaredBy" class="text-xs text-muted">
          Объявлено картой
          <NuxtLink :to="`/projects/${projectId}/records/${selection.declaredBy}`" class="hover:underline">
            {{ selection.declaredBy }}
          </NuxtLink>
          <template v-if="selection.kind === 'node' && selection.declaredAt">
            · {{ selection.declaredAt }} · {{ selection.declaredByRole ?? 'автор не указан' }}
          </template>
        </p>

        <div v-if="capView" class="space-y-2">
          <UBadge
            :color="BADGE_COLOR[capView.status ?? 'unrated']"
            :icon="STATUS_STYLE[capView.status ?? 'unrated'].icon"
            variant="subtle"
          >
            {{ statusText(capView) }}
          </UBadge>
          <div v-if="capView.priority || capView.horizon" class="flex flex-wrap gap-1">
            <UBadge v-if="capView.priority" size="xs" variant="subtle" color="neutral">
              {{ PRIORITY_LABEL[capView.priority.value] }}<template v-if="capView.priority.inherited"> · от «{{ titleOf(capView.priority.from) }}»</template>
            </UBadge>
            <UBadge v-if="capView.horizon" size="xs" variant="outline" color="neutral">
              {{ HORIZON_LABEL[capView.horizon.value] }}<template v-if="capView.horizon.inherited"> · от «{{ titleOf(capView.horizon.from) }}»</template>
            </UBadge>
          </div>
          <p v-if="capNote" class="leading-relaxed">{{ capNote }}</p>
          <div v-if="capView.flags.length" class="flex flex-wrap gap-1">
            <UBadge v-for="flag in capView.flags" :key="flag" size="xs" variant="subtle" color="warning">{{ RISK_LABEL[flag] }}</UBadge>
          </div>
          <p v-if="capView.inCycle" class="text-xs text-error">
            Две возможности ждут друг друга — по очереди их не сделать, граница проведена неверно.
          </p>
          <p v-else-if="waitingNames.length" class="text-xs text-warning">
            Ждёт: {{ waitingNames.join(', ') }} — начинать с неё нет смысла, пока зависимость не готова.
          </p>
          <p v-if="capView.replacedBy.length" class="text-xs text-warning">
            Заменяется на: {{ capView.replacedBy.map(titleOf).join(', ') }} — работа не должна уходить в то, что уходит.
          </p>
          <p class="text-xs text-muted">
            Освободит {{ capView.unblocks }} · опирается на {{ capView.reliesOn }} · на неё опираются {{ capView.reliedOnBy }}
          </p>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="!ghostOf"
              size="xs"
              variant="soft"
              :color="impactOn ? 'primary' : 'neutral'"
              icon="i-lucide-waypoints"
              @click="emit('impact')"
            >
              {{ impactOn ? 'Снять влияние' : 'Влияние' }}
            </UButton>
            <UButton
              v-if="capGroupOf && !ghostOf"
              size="xs"
              variant="soft"
              icon="i-lucide-folder-open"
              @click="emit('open-group', capGroupOf)"
            >
              Открыть группу
            </UButton>
          </div>
        </div>

        <p v-if="nodeSummary" class="leading-relaxed">{{ nodeSummary }}</p>

        <template v-if="capView && capView.links.length">
          <h3 class="font-medium">Связи</h3>
          <ul class="space-y-1">
            <li v-for="link in capView.links" :key="`${link.direction}:${link.type}:${link.id}`" class="text-xs">
              <span class="text-muted">{{ LINK_WORDS[link.direction][link.type] }}</span>
              {{ link.title }}<span v-if="link.summary" class="text-muted"> — {{ link.summary }}</span>
              <UBadge v-if="link.unsaved" class="ml-1" size="xs" variant="subtle" color="warning">не сохранено</UBadge>
              <UButton
                class="ml-1 align-middle"
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                title="Убрать связь (отложится в пачку)"
                @click="removeLink(link)"
              />
            </li>
          </ul>
        </template>

        <!-- Что стоит за возможностью в процессе: требования, задачи, проверки, код (docs/07-maps.md, «Покрытие процессом»). -->
        <template v-if="coverage">
          <h3 class="font-medium">Что стоит за ней в процессе</h3>
          <UBadge size="xs" variant="subtle" :color="coverage.level === 'failing' ? 'error' : coverage.level === 'verified' ? 'success' : 'neutral'">
            {{ COVERAGE_LABEL[coverage.level] }}
          </UBadge>
          <p v-if="coverage.level === 'none'" class="text-xs text-muted">Требований и задач нет.</p>
          <ul class="space-y-1 text-xs">
            <li v-if="coverage.requirements.ids.length">
              <span class="text-muted">Требования:</span>
              <NuxtLink
                v-for="id in coverage.requirements.ids"
                :key="id"
                :to="`/projects/${projectId}/records/${id}`"
                class="ml-1 hover:underline"
              >{{ id }} · {{ coverage.requirements.statuses[id] }}</NuxtLink>
            </li>
            <li v-if="coverage.tasks.ids.length">
              <span class="text-muted">Задачи:</span>
              <NuxtLink
                v-for="id in coverage.tasks.ids"
                :key="id"
                :to="`/projects/${projectId}/records/${id}`"
                class="ml-1 hover:underline"
              >{{ id }} · {{ coverage.tasks.statuses[id] }}</NuxtLink>
            </li>
            <li v-if="coverage.verifications.ids.length">
              <span class="text-muted">Проверки:</span>
              <NuxtLink
                v-for="id in coverage.verifications.ids"
                :key="id"
                :to="`/projects/${projectId}/records/${id}`"
                class="ml-1 hover:underline"
              >{{ id }} · {{ coverage.verifications.results[id] === 'none' ? 'не запускалась' : coverage.verifications.results[id] }}</NuxtLink>
            </li>
            <li v-for="item in coverage.code" :key="item.group">
              <span class="text-muted">Код:</span> группа <span class="font-mono">{{ item.group }}</span>, {{ plural(item.modules, 'модуль', 'модуля', 'модулей') }}
            </li>
          </ul>
          <p v-if="coverage.maps.length" class="text-xs text-muted">
            Через карты: {{ coverage.maps.join(', ') }} — связь с задачами точна до карты.
          </p>
        </template>

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
          v-else-if="!path && !nodeSummary && !nodeApi.length && selection.kind === 'node' && !groupOfNode && !flowGroupOf"
          class="text-muted"
        >
          Карта пока не описала этот узел — ни что он делает, ни его интерфейс, ни файл.
          Это появится после «Обновить карты».
        </p>
      </div>
    </template>
  </USlideover>
</template>
