<script setup lang="ts">
import type { ComponentPublicInstance } from 'vue';

import type { ApiFailure } from '~/composables/useProjectIndex';
import { highlightCode, type CodeToken } from '~/utils/highlight';
import { COVERAGE_LABEL, HORIZON_LABEL, PRIORITY_LABEL, crossLinksOf, type CrossLevelRelation } from '../../server/lib/functional';
import { RISK_LABEL, STATUS_STYLE, statusText, type CapabilityLink } from '~/utils/functional-view';
import type { MapSelection } from '~/utils/map-mermaid';
import type { EvidenceVerdict } from '~~/server/lib/maps'; const { t, tn } = useT();

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
  /** Сквозные связи функциональной карты: показываются только для выбранного узла (режим «Рентген»). */
  crossLevel?: CrossLevelRelation[];
  /** Связи между картами (R-0086): `вид:узел` → возможности, что на него ссылаются; и ссылки самих возможностей. */
  mapBacklinks?: Record<string, string[]>;
  capabilityMapLinks?: Record<string, string[]>;
  /** Контракт блока (R-0088): входы, выходы и входы, что ещё не готовы. */
  capabilityContracts?: Record<string, { inputs: string[]; outputs: string[]; notReady: string[] }>;
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
  get ok() { return t('t83.m2.ins.fileOk'); },
  get stale() { return t('t83.m2.ins.stale'); },
  get missing() { return t('t83.m2.ins.missing'); },
  get still_present() { return t('t83.m2.ins.still'); },
  get pending() { return t('t83.m2.ins.pending'); }
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
  out: { get depends() { return t('t83.m2.rel.depends'); }, get uses() { return t('t83.m2.rel.uses'); }, get feeds() { return t('t83.m2.rel.feedsIn'); }, get triggers() { return t('t83.m2.rel.triggers'); }, get replaces() { return t('t83.m2.rel.replaces'); } },
  in: { get depends() { return t('t83.m2.rel.in.depends'); }, get uses() { return t('t83.m2.rel.in.uses'); }, get feeds() { return t('t83.m2.rel.in.feeds'); }, get triggers() { return t('t83.m2.rel.in.triggers'); }, get replaces() { return t('t83.m2.rel.in.replaces'); } }
} as const;

function removeLink(link: CapabilityLink) {
  const self = props.selection?.kind === 'node' ? props.selection.id : '';
  emit('unrelate', link.direction === 'out'
    ? { from: self, to: link.id, type: link.type }
    : { from: link.id, to: self, type: link.type });
}
const titleOf = (id: string) => props.capabilityTitles?.[id] ?? id;
/** У возможности — её ссылки на узлы карт; у узла другой карты — «реализует возможность …». */
const outLinks = computed(() => (props.selection?.kind === 'node' && props.selection.capability ? (props.capabilityMapLinks?.[props.selection.id] ?? []) : []));
const inLinks = computed(() => {
  const sel = props.selection;
  if (sel?.kind !== 'node' || sel.capability) return [];
  return ['codemap', 'dataflow', 'userflow'].flatMap((kind) => props.mapBacklinks?.[`${kind}:${sel.id}`] ?? []);
});
const contract = computed(() => (props.selection?.kind === 'node' && props.selection.capability ? props.capabilityContracts?.[props.selection.id] : undefined));
/** Сверка пачки по возможности (R-0092): по кнопке, а не на каждый выбор узла. */
interface BatchReport { gaps: { kind: string; id: string; message: string }[]; clean: boolean }
const batch = ref<BatchReport | null>(null);
const batchBusy = ref(false);
watch(() => (props.selection?.kind === 'node' ? props.selection.id : ''), () => { batch.value = null; });
async function runBatch() {
  if (props.selection?.kind !== 'node') return;
  batchBusy.value = true;
  try {
    batch.value = await $fetch<BatchReport>(`/api/projects/${props.projectId}/batch-check`, { query: { capability: props.selection.id } });
  } catch { batch.value = null; } finally { batchBusy.value = false; }
}
const xray = computed(() => (props.selection?.kind === 'node' ? crossLinksOf(props.selection.id, props.crossLevel ?? []) : []));
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
          <h2 v-else class="font-medium">{{ t('t83.map-inspector.1') }}</h2>
          <p v-if="selection.kind === 'node' && selection.layer && !selection.group && !selection.flowGroup" class="text-sm text-muted">
            {{ t('t83.map-inspector.2', { layer: selection.layer }) }}
          </p>
          <p v-else-if="selection.kind === 'group'" class="text-sm text-muted">
            {{ selection.auto ? t('t83.m2.ins.auto') : t('t83.m2.ins.declared') }}
          </p>
          <p v-else-if="selection.kind === 'link' && selection.direction" class="text-sm text-muted">
            {{ selection.fromTitle }} {{ selection.directionText }} {{ selection.toTitle }}:
            {{ tn('t83.m2.pl.flow', selection.imports.length) }}
          </p>
          <p v-else-if="selection.kind === 'link'" class="text-sm text-muted">
            {{ t('t83.m2.ins.between', { imports: tn('t83.m2.pl.import', selection.imports.length) }) }}
          </p>
        </div>
        <UButton
          :icon="wide ? 'i-lucide-minimize-2' : 'i-lucide-maximize-2'"
          size="xs"
          color="neutral"
          variant="ghost"
          :title="wide ? t('t83.m2.collapse') : t('t83.m2.expand')"
          @click="wide = !wide"
        />
        <UButton
          icon="i-lucide-x"
          size="xs"
          color="neutral"
          variant="ghost"
          :title="t('t83.map-inspector.3')"
          @click="open = false"
        />
      </div>
    </template>

    <template #body>
      <div v-if="selection" class="space-y-4 text-sm">
        <div v-if="selection.kind === 'node'" class="space-y-1">
          <p class="font-mono text-xs text-muted">{{ selection.id }}</p>
          <p v-if="inLinks.length" class="text-xs">{{ t('t83.map-inspector.4') }} <span class="font-medium">{{ inLinks.map(titleOf).join(', ') }}</span></p>
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
          <p v-if="selection.arch" class="ds-card ds-card--bordered border-violet-400 bg-violet-50 p-2 text-xs text-violet-900 dark:bg-violet-950 dark:text-violet-200">
            <span class="font-semibold">{{ t('t83.map-inspector.5') }}</span> {{ selection.arch.message }}
          </p>
        </div>

        <!-- Узел обзора потоков: группа кода или вид источников. -->
        <div v-if="flowGroupOf" class="space-y-2">
          <p v-if="flowGroupOf.type === 'kind'" class="leading-relaxed">
            {{ t('t83.map-inspector.6') }}
          </p>
          <p v-else-if="!groupOfNode" class="leading-relaxed">
            {{ t('t83.map-inspector.7') }}

          </p>
          <UButton size="sm" icon="i-lucide-folder-open" @click="emit('open-flow', flowGroupOf)">{{ t('t83.map-inspector.8') }}</UButton>
        </div>

        <!-- Призрак: сосед выбранного модуля из другой группы — не часть открытой (docs/04-ui.md). -->
        <div v-if="ghostOf" class="flex flex-wrap items-center gap-2">
          <UBadge color="neutral" variant="outline">{{ t('t83.map-inspector.9', { groupTitle: ghostOf.groupTitle }) }}</UBadge>
          <UButton size="xs" variant="soft" icon="i-lucide-folder-open" @click="emit('open-group', ghostOf.groupId)">
            {{ t('t83.map-inspector.10') }}
          </UButton>
        </div>

        <!-- Карточка группы -->
        <div v-if="selection.kind === 'group' || groupOfNode" class="space-y-3">
          <template v-for="card in [selection.kind === 'group' ? selection : groupOfNode]" :key="card?.groupId">
            <template v-if="card">
              <p v-if="card.summary" class="leading-relaxed">{{ card.summary }}</p>
              <p v-else-if="card.auto" class="text-muted">
                {{ t('t83.map-inspector.11') }}
              </p>
              <p v-else class="text-muted">{{ t('t83.map-inspector.12') }}</p>
              <p v-if="card.capability" class="text-xs text-muted">
                {{ t('t83.map-inspector.13') }}
                <template v-if="capabilityTitles?.[card.capability]">«{{ capabilityTitles[card.capability] }}»</template>
                <template v-else><span class="font-mono">{{ card.capability }}</span> {{ t('t83.map-inspector.14') }}</template>
              </p>
              <p v-if="card.declaredBy" class="text-xs text-muted">
                {{ t('t83.map-inspector.15') }}
                <NuxtLink :to="`/projects/${projectId}/records/${card.declaredBy}`" class="hover:underline">
                  {{ card.declaredBy }}
                </NuxtLink>
              </p>

              <p>{{ tn('t83.m2.pl.module', card.moduleCount) }}</p>
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
                {{ t('t83.map-inspector.10') }}
              </UButton>

              <template v-if="card.surface.length">
                <h3 class="font-medium">{{ t('t83.map-inspector.16') }}</h3>
                <p class="text-xs text-muted">{{ t('t83.map-inspector.17') }}</p>
                <ul class="space-y-1">
                  <li v-for="item in card.surface" :key="item.id" class="text-xs">
                    <span class="font-mono">{{ item.title ?? item.id }}</span>
                    <span class="text-muted"> — {{ tn('t83.m2.pl.group', item.importers) }}</span>
                  </li>
                </ul>
              </template>

              <template v-if="card.dependsOn.length">
                <h3 class="font-medium">{{ t('t83.map-inspector.18') }}</h3>
                <ul class="space-y-1">
                  <li v-for="item in card.dependsOn" :key="item.groupId" class="text-xs">
                    <button type="button" class="hover:underline" @click="emit('open-group', item.groupId)">{{ item.title }}</button>
                    <span class="text-muted"> — {{ tn('t83.m2.pl.import', item.count) }}</span>
                  </li>
                </ul>
              </template>

              <template v-if="card.usedBy.length">
                <h3 class="font-medium">{{ t('t83.map-inspector.19') }}</h3>
                <ul class="space-y-1">
                  <li v-for="item in card.usedBy" :key="item.groupId" class="text-xs">
                    <button type="button" class="hover:underline" @click="emit('open-group', item.groupId)">{{ item.title }}</button>
                    <span class="text-muted"> — {{ tn('t83.m2.pl.import', item.count) }}</span>
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
            {{ t('t83.map-inspector.20') }}
          </p>
          <ul class="space-y-2">
            <li v-for="item in selection.imports" :key="`${item.from}>${item.to}`" class="ds-card p-2">
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
          {{ t('t83.map-inspector.21') }}
        </UBadge>

        <p v-if="(selection.kind === 'node' || selection.kind === 'edge') && selection.declaredBy" class="text-xs text-muted">
          {{ t('t83.map-inspector.22') }}
          <NuxtLink :to="`/projects/${projectId}/records/${selection.declaredBy}`" class="hover:underline">
            {{ selection.declaredBy }}
          </NuxtLink>
          <template v-if="selection.kind === 'node' && selection.declaredAt">
            · {{ selection.declaredAt }} · {{ selection.declaredByRole ?? t('t83.m2.anon') }}
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
              {{ PRIORITY_LABEL[capView.priority.value] }}<template v-if="capView.priority.inherited"> {{ t('t83.map-inspector.23', { p: titleOf(capView.priority.from) }) }}</template>
            </UBadge>
            <UBadge v-if="capView.horizon" size="xs" variant="outline" color="neutral">
              {{ HORIZON_LABEL[capView.horizon.value] }}<template v-if="capView.horizon.inherited"> {{ t('t83.map-inspector.23', { p: titleOf(capView.horizon.from) }) }}</template>
            </UBadge>
          </div>
          <p v-if="capNote" class="leading-relaxed">{{ capNote }}</p>
          <div v-if="capView.flags.length" class="flex flex-wrap gap-1">
            <UBadge v-for="flag in capView.flags" :key="flag" size="xs" variant="subtle" color="warning">{{ RISK_LABEL[flag] }}</UBadge>
          </div>
          <p v-if="capView.inCycle" class="text-xs text-error">
            {{ t('t83.map-inspector.24') }}
          </p>
          <p v-else-if="waitingNames.length" class="text-xs text-warning">
            {{ t('t83.map-inspector.25', { p: waitingNames.join(', ') }) }}
          </p>
          <p v-if="capView.replacedBy.length" class="text-xs text-warning">
            {{ t('t83.map-inspector.26', { p: capView.replacedBy.map(titleOf).join(', ') }) }}
          </p>
          <div v-if="!ghostOf && !capGroupOf" class="space-y-1">
            <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-clipboard-check" :loading="batchBusy" @click="runBatch">{{ t('t83.map-inspector.27') }}</UButton>
            <p v-if="batch?.clean" class="text-xs text-success">{{ t('t83.map-inspector.28') }}</p>
            <ul v-else-if="batch" class="space-y-0.5 text-xs text-warning">
              <li v-for="gap in batch.gaps" :key="`${gap.kind}:${gap.id}`">{{ gap.message }}</li>
            </ul>
          </div>
          <div v-if="contract" class="space-y-1">
            <p v-if="contract.inputs.length" class="text-xs">
              <span class="font-medium">{{ t('t83.map-inspector.29') }}</span>
              <template v-for="input in contract.inputs" :key="input"> <span :class="contract.notReady.includes(input) ? 'text-warning' : ''">{{ input }}<template v-if="contract.notReady.includes(input)"> {{ t('t83.map-inspector.30') }}</template></span>;</template>
            </p>
            <p v-if="contract.outputs.length" class="text-xs"><span class="font-medium">{{ t('t83.map-inspector.31') }}</span> {{ contract.outputs.join('; ') }}</p>
          </div>
          <div v-if="outLinks.length" class="space-y-1">
            <p class="text-xs font-medium">{{ t('t83.map-inspector.32') }}</p>
            <p v-for="link in outLinks" :key="link" class="font-mono text-xs">{{ link }}</p>
          </div>
          <!-- Рентген: связи, что минуют уровни, по умолчанию скрыты и видны только у выбранного узла. -->
          <div v-if="xray.length" class="space-y-1 border-l-2 border-dashed border-warning pl-2">
            <p class="text-xs font-medium text-warning">{{ t('t83.map-inspector.33') }}</p>
            <p v-for="link in xray" :key="`${link.from}>${link.to}:${link.type}`" class="text-xs">
              {{ link.from === selection.id ? (LINK_WORDS.out as Record<string, string>)[link.type] : (LINK_WORDS.in as Record<string, string>)[link.type] }}
              «{{ titleOf(link.from === selection.id ? link.to : link.from) }}» <span class="text-muted">{{ t('t83.map-inspector.34', { gap: link.gap }) }}</span>
            </p>
          </div>
          <p class="text-xs text-muted">
            {{ t('t83.map-inspector.35', { unblocks: capView.unblocks, reliesOn: capView.reliesOn, reliedOnBy: capView.reliedOnBy }) }}
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
              {{ impactOn ? t('t83.m2.ins.impactOff') : t('t83.m2.ins.impact') }}
            </UButton>
            <UButton
              v-if="capGroupOf && !ghostOf"
              size="xs"
              variant="soft"
              icon="i-lucide-folder-open"
              @click="emit('open-group', capGroupOf)"
            >
              {{ t('t83.map-inspector.10') }}
            </UButton>
          </div>
        </div>

        <p v-if="nodeSummary" class="leading-relaxed">{{ nodeSummary }}</p>

        <template v-if="capView && capView.links.length">
          <h3 class="font-medium">{{ t('t83.map-inspector.36') }}</h3>
          <ul class="space-y-1">
            <li v-for="link in capView.links" :key="`${link.direction}:${link.type}:${link.id}`" class="text-xs">
              <span class="text-muted">{{ LINK_WORDS[link.direction][link.type] }}</span>
              {{ link.title }}<span v-if="link.summary" class="text-muted"> — {{ link.summary }}</span>
              <UBadge v-if="link.unsaved" class="ml-1" size="xs" variant="subtle" color="warning">{{ t('t83.map-inspector.37') }}</UBadge>
              <UButton
                class="ml-1 align-middle"
                icon="i-lucide-x"
                size="xs"
                variant="ghost"
                color="neutral"
                :title="t('t83.map-inspector.38')"
                @click="removeLink(link)"
              />
            </li>
          </ul>
        </template>

        <!-- Что стоит за возможностью в процессе: требования, задачи, проверки, код (docs/07-maps.md, «Покрытие процессом»). -->
        <template v-if="coverage">
          <h3 class="font-medium">{{ t('t83.map-inspector.39') }}</h3>
          <UBadge size="xs" variant="subtle" :color="coverage.level === 'failing' ? 'error' : coverage.level === 'verified' ? 'success' : 'neutral'">
            {{ COVERAGE_LABEL[coverage.level] }}
          </UBadge>
          <p v-if="coverage.level === 'none'" class="text-xs text-muted">{{ t('t83.map-inspector.40') }}</p>
          <ul class="space-y-1 text-xs">
            <li v-if="coverage.requirements.ids.length">
              <span class="text-muted">{{ t('t83.map-inspector.41') }}</span>
              <NuxtLink
                v-for="id in coverage.requirements.ids"
                :key="id"
                :to="`/projects/${projectId}/records/${id}`"
                class="ml-1 hover:underline"
              >{{ id }} · {{ coverage.requirements.statuses[id] }}</NuxtLink>
            </li>
            <li v-if="coverage.tasks.ids.length">
              <span class="text-muted">{{ t('t83.map-inspector.42') }}</span>
              <NuxtLink
                v-for="id in coverage.tasks.ids"
                :key="id"
                :to="`/projects/${projectId}/records/${id}`"
                class="ml-1 hover:underline"
              >{{ id }} · {{ coverage.tasks.statuses[id] }}</NuxtLink>
            </li>
            <li v-if="coverage.verifications.ids.length">
              <span class="text-muted">{{ t('t83.map-inspector.43') }}</span>
              <NuxtLink
                v-for="id in coverage.verifications.ids"
                :key="id"
                :to="`/projects/${projectId}/records/${id}`"
                class="ml-1 hover:underline"
              >{{ id }} · {{ coverage.verifications.results[id] === 'none' ? t('t83.m2.ins.notRun') : coverage.verifications.results[id] }}</NuxtLink>
            </li>
            <li v-for="item in coverage.code" :key="item.group">
              <span class="text-muted">{{ t('t83.map-inspector.44') }}</span> {{ t('t83.map-inspector.45') }} <span class="font-mono">{{ item.group }}</span>, {{ tn('t83.m2.pl.module', item.modules) }}
            </li>
          </ul>
          <p v-if="coverage.maps.length" class="text-xs text-muted">
            {{ t('t83.map-inspector.46', { p: coverage.maps.join(', ') }) }}
          </p>
        </template>

        <template v-if="nodeApi.length">
          <h3 class="font-medium">{{ t('t83.map-inspector.47') }}</h3>
          <ul class="space-y-2">
            <li v-for="item in nodeApi" :key="item.name" class="ds-card p-2">
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
            <h3 class="font-medium">{{ t('t83.map-inspector.48') }}</h3>
            <UButton
              v-if="file"
              class="ml-auto"
              :icon="wrap ? 'i-lucide-move-horizontal' : 'i-lucide-wrap-text'"
              size="xs"
              color="neutral"
              variant="ghost"
              :title="wrap ? t('t83.m2.ins.noWrap') : t('t83.m2.ins.wrap')"
              @click="wrap = !wrap"
            />
          </div>
          <p class="font-mono text-xs text-muted">{{ path }}</p>

          <p v-if="loadingFile" class="text-muted">{{ t('t83.map-inspector.49') }}</p>
          <UAlert
            v-else-if="fileFailure"
            color="warning"
            variant="subtle"
            :title="fileFailure.message"
          />
          <div
            v-else-if="file"
            class="overflow-auto ds-card"
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
          {{ t('t83.map-inspector.50') }}

        </p>
        <p
          v-else-if="!path && !nodeSummary && !nodeApi.length && selection.kind === 'node' && !groupOfNode && !flowGroupOf"
          class="text-muted"
        >
          {{ t('t83.map-inspector.51') }}

        </p>
      </div>
    </template>
  </USlideover>
</template>
