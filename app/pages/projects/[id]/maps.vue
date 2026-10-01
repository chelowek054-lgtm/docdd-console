<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { MapSelection, MermaidEdge } from '~/utils/map-mermaid';
import {
  IMPL_LABEL,
  RELATION_LABEL,
  overallProgress,
  withMarks,
  type ImplStatus,
  type Mark,
  type StatusFilter
} from '~~/server/lib/functional';
import { ghostNeighbors, groupCard, groupModules, groupScope, portsOf } from '~~/server/lib/groups';
import type { ProjectMap } from '~~/server/lib/maps';
import { STATUS_STYLE } from '~/utils/functional-view';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

type MapResponse = ProjectMap & { unverified: number };

const { data, refresh, status } = useFetch<MapResponse | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/map`,
  { key: () => `map:${projectId.value}` }
);

const saving = ref(false);
const draftId = ref('');
const draftFailure = ref<ApiFailure | null>(null);
const creatingTask = ref(false);
const taskId = ref('');
/** Ответ, поправленный моделью: заменяет прошлый, пока его не сохранили. */
const fixed = ref('');

const { running: fixing, elapsed, outcome, log, stream, cancel } = useModelRequest();

/** Претензии схемы дословно: их и получит модель. */
const problems = computed(() => (draftFailure.value?.blockers ?? []).map((blocker) => blocker.message));

/**
 * Второй ход после отказа схемы: разбор файлов заново не идёт, чинится
 * только форма (docs/07-maps.md, раздел «Ответ не прошёл схему»).
 */
async function askToFix(answer: string) {
  const built = await $fetch<{ prompt: string } | { error: ApiFailure }>(
    `/api/projects/${projectId.value}/prompt`,
    { method: 'POST', body: { kind: 'map-fix', answer, problems: problems.value }, ignoreResponseError: true }
  );
  const problem = failureOf(built);
  if (problem) {
    draftFailure.value = problem;
    return;
  }

  const result = await stream<{ answer: string }>('/api/llm/ask', {
    prompt: (built as { prompt: string }).prompt,
    projectId: projectId.value
  });
  if (!result) return;

  fixed.value = result.answer;
  draftFailure.value = null;
}

/** Ответ модели сохраняется черновиком: подтверждает человек, а не приложение. */
async function saveDraft(answer: string) {
  saving.value = true;
  draftFailure.value = null;
  draftId.value = '';
  try {
    const response = await $fetch(`/api/projects/${projectId.value}/map/draft`, {
      method: 'POST',
      body: { answer },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      draftFailure.value = problem;
      return;
    }
    draftId.value = (response as { record?: { id: string } }).record?.id ?? '';
    taskId.value = '';
    await refresh();
  } finally {
    saving.value = false;
  }
}

/**
 * Пока карта-черновик не подтверждена, а связанная задача не закрыта, узлы и
 * рёбра, которые она объявила, помечаются на диаграмме как не совпадающие с
 * кодовой базой (`server/lib/maps.ts`, `pending`) — тот же смысл, что несёт
 * `affects`/`change: feature` в правиле `task_maps_unapproved`
 * (`server/lib/rules.ts`), просто заведённый одной кнопкой, а не руками
 * через «Новая запись» на экране задач.
 */
async function createImplementingTask() {
  if (!draftId.value) return;
  creatingTask.value = true;
  try {
    const response = await $fetch(`/api/projects/${projectId.value}/records`, {
      method: 'POST',
      body: {
        type: 'task',
        title: `Реализовать карту ${draftId.value}`,
        change: 'feature',
        links: { affects: [draftId.value] }
      },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      draftFailure.value = problem;
      return;
    }
    taskId.value = (response as { record?: { id: string } }).record?.id ?? '';
  } finally {
    creatingTask.value = false;
  }
}

function onAnswer() {
  draftId.value = '';
  draftFailure.value = null;
  fixed.value = '';
  taskId.value = '';
}

const { index } = useProjectIndex(projectId);

/** Карты, которые есть, но в картину не входят: черновики и заменённые. */
const aside = computed(() => {
  const records = (index.value?.records ?? []).filter((record) => record.type === 'map');
  return {
    drafts: records.filter((record) => record.status === 'draft' || record.status === 'review'),
    superseded: records.filter((record) => record.status === 'superseded')
  };
});

const failure = computed(() => failureOf(data.value));
const map = computed(() => (failure.value ? null : (data.value as MapResponse | null)));

/**
 * Записи карт видны всегда, а не только когда картина пуста (docs/04-ui.md,
 * «Карты»): черновик от «Обновить карты» не должен находиться только по
 * номеру, мелькнувшему в ответе. Пустая строка не показывается.
 */
const mapRecords = computed(() => {
  const all = (index.value?.records ?? [])
    .filter((record) => record.type === 'map')
    .sort((a, b) => a.id.localeCompare(b.id));
  const waiting = (status: string) => status === 'draft' || status === 'review';
  return [
    { label: 'Подтверждены', records: all.filter((record) => record.status === 'approved') },
    { label: 'Ждут подтверждения', records: all.filter((record) => waiting(record.status)) },
    { label: 'Вне суммы', records: all.filter((record) => record.status !== 'approved' && !waiting(record.status)) }
  ].filter((group) => group.records.length > 0);
});

/**
 * Группы кодовой карты — уровень над модулями (docs/07-maps.md, «Группы:
 * уровень над модулями»; docs/04-ui.md, «Группы кодовой карты»). Три уровня
 * экрана: обзор групп, одна группа целиком, выбранный модуль с соседями из
 * других групп. Режим и открытая группа живут в адресе — ссылкой можно
 * поделиться.
 */
const router = useRouter();

/** Больше стольких модулей (и хотя бы две группы) — экран открывается обзором групп, а не всеми модулями разом. */
const GROUPED_CODEMAP = 40;

const grouping = computed(() => {
  const value = map.value;
  return value ? groupModules(value.codemap.modules, value.codemap.imports) : null;
});

const codemapMode = computed<'groups' | 'group' | 'all'>(() => {
  const found = grouping.value;
  if (!found) return 'all';
  if (found.byId.has(String(route.query['group'] ?? ''))) return 'group';
  const wanted = String(route.query['view'] ?? '');
  if (wanted === 'all' || found.groups.length < 2) return 'all';
  if (wanted === 'groups') return 'groups';
  return (map.value?.codemap.modules.length ?? 0) > GROUPED_CODEMAP ? 'groups' : 'all';
});
const openGroupId = computed(() => (codemapMode.value === 'group' ? String(route.query['group']) : ''));
const openGroupInfo = computed(() => (openGroupId.value && grouping.value ? groupCard(grouping.value, openGroupId.value) : null));

/** Выбранный модуль открытой группы — его соседи из других групп показываются «призраками». */
const ghostFor = ref<string | null>(null);

function goTo(query: { view?: string; group?: string }) {
  selection.value = null;
  ghostFor.value = null;
  void router.push({ query: { ...route.query, view: undefined, group: undefined, ...query } });
}
const showGroups = () => goTo({ view: 'groups' });
const showAllModules = () => goTo({ view: 'all' });
const enterGroup = (groupId: string) => goTo({ group: groupId });

/** Что рисует кодовая карта сейчас: все модули или модули одной группы с импортами между ними. */
const scopeCodemap = computed(() => {
  const value = map.value;
  if (!value) return null;
  if (codemapMode.value !== 'group' || !grouping.value) return value.codemap;
  const ids = new Set((grouping.value.byId.get(openGroupId.value)?.members ?? []).map((member) => member.id));
  return {
    modules: value.codemap.modules.filter((item) => ids.has(item.id)),
    imports: groupScope(grouping.value, openGroupId.value, value.codemap.imports).imports as typeof value.codemap.imports
  };
});

/** Смена области — повод забыть выбор слоёв: у другой группы свои слои. */
const scopeKey = computed(() => `${codemapMode.value}:${openGroupId.value}`);
watch(scopeKey, () => {
  chosenHiddenLayers.value = null;
  selection.value = null;
  ghostFor.value = null;
});

/**
 * Слои кодовой базы — чипы над диаграммой. Клик изолирует: остаётся виден
 * только этот слой, повторный клик по нему же возвращает все. Скрытые
 * запоминаются по имени слоя, а не по индексу — переживают «Обновить карты»
 * и новые слои сами не пропадают из списка.
 */
const allLayers = computed(() => {
  const set = new Set<string>();
  for (const item of scopeCodemap.value?.modules ?? []) set.add(item.layer ?? 'без слоя');
  return [...set].sort();
});

/**
 * Крупная кодовая база — та, что при полной раскладке mermaid ощутимо
 * подвешивает вкладку (сотни модулей, тысячи пересечений линий). Порог
 * приблизительный: важно не точное число, а сам факт, что рисовать всё
 * разом больше не бесплатно (docs/07-maps.md, «Крупная кодовая база»).
 */
const LARGE_CODEMAP = 150;
const isLargeCodemap = computed(() => (scopeCodemap.value?.modules.length ?? 0) > LARGE_CODEMAP);

/** Самый маленький по числу модулей слой — с него начинают знакомство с крупной базой. */
const smallestLayer = computed(() => {
  const sizes = new Map<string, number>();
  for (const item of scopeCodemap.value?.modules ?? []) {
    const layer = item.layer ?? 'без слоя';
    sizes.set(layer, (sizes.get(layer) ?? 0) + 1);
  }
  return [...allLayers.value].sort((a, b) => (sizes.get(a) ?? 0) - (sizes.get(b) ?? 0))[0] ?? null;
});

/**
 * Чипы, скрытые явным кликом человека. Пусто — значит человек ещё не решал
 * сам: тогда решает `hiddenLayers` (ниже) — производное, не хранимое
 * состояние, чтобы отрисовка на сервере и на клиенте при гидратации совпала
 * до последнего байта (ref, наполненный сайд-эффектом в watch, до первой
 * отрисовки на клиенте успевал разойтись с тем, что уже отдал сервер).
 */
const chosenHiddenLayers = ref<Set<string> | null>(null);

/**
 * Слои кодовой базы — чипы над диаграммой. Клик изолирует: остаётся виден
 * только этот слой, повторный клик по нему же возвращает все. На крупной
 * базе, пока человек ни разу не тронул чипы, изолирован сам маленький слой
 * — не все сотни модулей разом (docs/07-maps.md, «Крупная кодовая база»).
 */
const hiddenLayers = computed(() => {
  if (chosenHiddenLayers.value) return chosenHiddenLayers.value;
  if (!isLargeCodemap.value || !smallestLayer.value) return new Set<string>();
  return new Set(allLayers.value.filter((layer) => layer !== smallestLayer.value));
});
function toggleLayer(layer: string) {
  const isolated = hiddenLayers.value.size === allLayers.value.length - 1 && !hiddenLayers.value.has(layer);
  chosenHiddenLayers.value = isolated ? new Set() : new Set(allLayers.value.filter((item) => item !== layer));
}

/**
 * Кодовая база с вычетом скрытых слоёв — рёбра к спрятанному модулю тоже
 * прячутся. Диаграмма строится заново на каждый клик по чипу (mermaid не
 * умеет иначе), но раз слоёв на экране всегда один-два, а не все разом,
 * пересборка остаётся дешёвой даже на крупной базе (docs/04-ui.md, «Карты»).
 */
const filteredCodemap = computed(() => {
  const value = scopeCodemap.value;
  if (!value || hiddenLayers.value.size === 0) return value;
  const visible = new Set(
    value.modules.filter((item) => !hiddenLayers.value.has(item.layer ?? 'без слоя')).map((item) => item.id)
  );
  return {
    modules: value.modules.filter((item) => visible.has(item.id)),
    imports: value.imports.filter((edge) => visible.has(edge.from) && visible.has(edge.to))
  };
});

/**
 * Кодовая карта в открытой группе: порты обведены, а у выбранного модуля
 * появляются соседи из других групп. Обзор групп — отдельная диаграмма.
 */
const codemapView = computed(() => {
  const value = map.value;
  const found = grouping.value;
  if (!value || !found) return null;
  if (codemapMode.value === 'groups') return groupOverviewMermaid(found);

  const base = filteredCodemap.value ?? value.codemap;
  if (codemapMode.value === 'all') return codemapMermaid({ ...value, codemap: base });

  const selected = ghostFor.value && base.modules.some((item) => item.id === ghostFor.value) ? ghostFor.value : null;
  const near = selected
    ? ghostNeighbors(found, openGroupId.value, selected, value.codemap.modules, value.codemap.imports)
    : { ghosts: [], imports: [] };
  return codemapMermaid({ ...value, codemap: base }, {
    ports: portsOf(found, openGroupId.value, value.codemap.imports),
    ghosts: near.ghosts,
    ghostImports: near.imports,
    ghostCards: new Map(near.ghosts.flatMap((ghost) => {
      const card = ghost.collapsed ? groupCard(found, ghost.groupId) : null;
      return card ? [[ghost.groupId, card] as const] : [];
    }))
  });
});

/** Узлы-призраки: полупрозрачные (0.65), а не 0.5 — это другое, чем «карта не устоялась». */
const ghostNodeIds = computed(() => {
  const set = new Set<string>();
  for (const [key, node] of Object.entries(current.value?.nodes ?? {})) {
    if (node.ghost) set.add(key);
  }
  return set;
});

/**
 * Узлы, объявленные картой, которая ещё не устоялась (`server/lib/maps.ts`,
 * `pending`) — рисуются полупрозрачными во всех видах (2D и 3D читают то же
 * поле каждый по-своему, MermaidDiagram.vue берёт его отдельным id-списком,
 * т.к. не получает полный `nodes`).
 */
const pendingNodeIds = computed(() => {
  const set = new Set<string>();
  for (const [key, node] of Object.entries(current.value?.nodes ?? {})) {
    if (node.pending) set.add(key);
  }
  return set;
});

/**
 * Состояние реализации функциональной карты: отметки, ещё не сохранённые в
 * карту, лежат здесь и накладываются поверх картины — их видят и дерево, и
 * граф, и «Проверить по коду» кладёт сюда же (docs/04-ui.md, «Функциональная
 * карта»). Фильтр по состоянию — тоже общий.
 */
const marks = ref<Record<string, Mark>>({});
const statusFilter = ref<StatusFilter | null>(null);
const functionalEffective = computed(() => {
  const source = map.value?.functional;
  return {
    capabilities: withMarks(source?.capabilities ?? [], marks.value),
    relations: source?.relations ?? []
  };
});
const functionalProgress = computed(() => overallProgress(functionalEffective.value.capabilities));

const legendKeys = ['implemented', 'partial', 'not_implemented', 'unrated'] as const;

/** «Занести отметки» из «Проверить по коду»: в несохранённые отметки, не в карту. */
function applyChecks(rows: { id: string; status: ImplStatus; note: string }[]) {
  const next = { ...marks.value };
  for (const row of rows) next[row.id] = { status: row.status, note: row.note };
  marks.value = next;
}

/** Закрыть вкладку с несохранёнными отметками — браузер предупредит о потере. */
function warnUnsaved(event: BeforeUnloadEvent) {
  if (Object.keys(marks.value).length === 0) return;
  event.preventDefault();
}
onMounted(() => window.addEventListener('beforeunload', warnUnsaved));
onUnmounted(() => window.removeEventListener('beforeunload', warnUnsaved));

const views = computed(() => {
  const value = map.value;
  if (!value) return [];
  return [
    {
      key: 'codemap',
      title: 'Кодовая база',
      question: 'Из чего состоит проект и что на что опирается',
      count: `${value.codemap.modules.length} модулей, ${value.codemap.imports.length} связей`,
      ...(codemapView.value ?? codemapMermaid(value))
    },
    {
      key: 'dataflow',
      title: 'Потоки данных',
      question: 'Откуда данные приходят, где лежат и куда уходят',
      count: `${value.dataflow.sources.length} источников, ${value.dataflow.flows.length} потоков`,
      ...dataflowMermaid(value)
    },
    {
      key: 'userflow',
      title: 'Пользовательские пути',
      question: 'Какие экраны есть, как между ними ходят и что каждый дёргает',
      count: `${value.userflow.screens.length} экранов, ${value.userflow.calls.length} вызовов`,
      ...userflowMermaid(value)
    },
    {
      key: 'functional',
      title: 'Функциональная карта',
      question: 'Что система умеет на языке предметной области, не кода',
      count: `${value.functional.capabilities.length} возможностей`,
      ...functionalMermaid({ ...value, functional: functionalEffective.value }, statusFilter.value)
    }
  ];
});

const shown = ref<'codemap' | 'dataflow' | 'userflow' | 'functional'>('codemap');
const current = computed(() => views.value.find((view) => view.key === shown.value));

/**
 * 2D — основной режим: детерминированная раскладка по слоям, читаемая без
 * привыкания. 3D — переключатель поверх неё же для обзора плотной картины
 * (`MermaidDiagram3D.vue`); функциональной карте (дерево, не граф связей) он
 * не идёт — у неё связей вообще нет (docs/07-maps.md), 3D нечего раскладывать.
 */
const viewMode = ref<'2d' | '3d'>('2d');

/**
 * У функциональной карты свой переключатель — дерево (читает доменный
 * специалист, docs/07-maps.md, «Экран: дерево, граф состояния») или граф
 * состояния — возможности цветом по состоянию и стрелки связей. Текст и узлы
 * уже посчитаны (`functionalMermaid` в `views` выше) — включение режима
 * ничего не пересчитывает.
 */
const functionalView = ref<'tree' | 'graph'>('tree');

/**
 * Общий контейнер диаграммы и карточки — цель разворота на весь экран.
 * Карточку телепортируем в него ТОЛЬКО в полноэкранном режиме: иначе её
 * лучше держать в `<body>` — поверх всей страницы, выше панелей диаграммы,
 * а не в общем потоке с ними (docs/04-ui.md, «Карты»).
 */
const stage = ref<HTMLElement | null>(null);
const staged = ref(false);
function onFullscreenChange() {
  const el = document.fullscreenElement;
  staged.value = !!el && (el === stage.value || !!stage.value?.contains(el));
}
onMounted(() => document.addEventListener('fullscreenchange', onFullscreenChange));
onUnmounted(() => document.removeEventListener('fullscreenchange', onFullscreenChange));

const copied = ref(false);
async function copySource() {
  const source = current.value?.text;
  if (!source) return;
  await navigator.clipboard.writeText(source);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}

/**
 * Узел ведёт к коду, ребро — к свидетельству (docs/04-ui.md, «Карты»):
 * карточка открывается сбоку, диаграмма остаётся под рукой.
 */
const selection = ref<MapSelection | null>(null);
function onNodeClick(id: string) {
  const node = current.value?.nodes?.[id];
  if (!node) return; // Нет метаданных — карте нечего показать (functional map, неизвестный узел).
  // На обзоре узел — группа: карточка группы, а не файла.
  if (shown.value === 'codemap' && codemapMode.value === 'groups' && node.group) {
    selection.value = { kind: 'group', ...node.group };
    return;
  }
  selection.value = { kind: 'node', ...node };
  // Выбранный модуль открытой группы показывает соседей из других групп; призрак выбором не становится.
  if (shown.value === 'codemap' && codemapMode.value === 'group' && !node.ghost) ghostFor.value = node.id;
}
function onNodeDblClick(id: string) {
  const node = current.value?.nodes?.[id];
  if (shown.value === 'codemap' && codemapMode.value === 'groups' && node?.group) enterGroup(node.group.groupId);
}
function onBackgroundClick() {
  selection.value = null;
  ghostFor.value = null;
}
function onEdgeClick(edge: MermaidEdge) {
  if (edge.link) {
    selection.value = { kind: 'link', ...edge.link };
    return;
  }
  selection.value = { kind: 'edge', evidence: edge.evidence, status: edge.status, declaredBy: edge.declaredBy };
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Карты проекта</h1>
        <p v-if="map" class="text-sm text-muted">
          сложено из {{ plural(map.from.length, 'карты', 'карт', 'карт') }}
        </p>
        <UBadge v-if="map && map.unverified > 0" color="error" variant="subtle" class="ml-auto">
          {{ map.unverified }} утверждений не прошли сверку
        </UBadge>
        <UButton
          :class="map && map.unverified > 0 ? '' : 'ml-auto'"
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-refresh-cw"
          :loading="status === 'pending'"
          @click="refresh()"
        >
          Перечитать
        </UButton>
      </div>

      <div v-if="mapRecords.length" class="space-y-1 text-sm">
        <p v-for="group in mapRecords" :key="group.label" class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span class="text-muted">{{ group.label }}:</span>
          <RecordLink
            v-for="record in group.records"
            :key="record.path"
            :project-id="projectId"
            :record-id="record.id"
            :record="record"
          />
        </p>
      </div>

      <MapInventory :project-id="projectId" />

      <PromptPanel
        :project-id="projectId"
        kind="maps"
        label="Обновить карты"
        hint="Ответ сохраняется черновиком и требует подтверждения"
        @answered="onAnswer"
      >
        <template #answer="{ answer }">
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <UButton size="sm" :loading="saving" @click="saveDraft(fixed || answer)">
              Сохранить черновиком
            </UButton>

            <!-- Разбор сорока файлов не выбрасывается из-за лишнего ключа. -->
            <UButton
              v-if="draftFailure && !fixing"
              size="sm"
              variant="soft"
              icon="i-lucide-wand-sparkles"
              @click="askToFix(fixed || answer)"
            >
              Попросить поправить
            </UButton>
            <NuxtLink
              v-if="draftId"
              :to="`/projects/${projectId}/records/${draftId}`"
              class="text-sm hover:underline"
            >Черновик {{ draftId }} создан — открыть</NuxtLink>
            <UButton
              v-if="draftId && !taskId"
              size="sm"
              variant="soft"
              icon="i-lucide-list-plus"
              :loading="creatingTask"
              @click="createImplementingTask"
            >
              Завести задачу-реализацию
            </UButton>
            <NuxtLink
              v-if="taskId"
              :to="`/projects/${projectId}/records/${taskId}`"
              class="text-sm hover:underline"
            >Задача {{ taskId }} заведена — открыть</NuxtLink>
            <UAlert
              v-if="draftFailure"
              color="error"
              variant="subtle"
              :title="draftFailure.message"
              :description="problems.join(' ')"
            />
          </div>

          <ModelProgress
            class="mb-3"
            :running="fixing"
            :elapsed="elapsed"
            :outcome="outcome"
            @cancel="cancel"
          />
          <ModelLog class="mb-3" :lines="log" :running="fixing" />

          <div v-if="fixed" class="mb-3">
            <p class="mb-2 text-sm text-muted">Модель поправила форму. Ниже — исправленный ответ:</p>
            <pre class="max-h-72 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre-wrap">{{ fixed }}</pre>
          </div>
        </template>
      </PromptPanel>

      <p class="text-sm text-muted">
        Картина складывается из подтверждённых карт изменений. Черновики сюда не
        входят: пока человек не подтвердил, это намерение, а не устройство проекта.
      </p>

      <div
        v-if="map && map.from.length === 0"
        class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        <!-- Пусто — тоже ответ, и он обязан назвать причину (docs/04-ui.md). -->
        <template v-if="aside.superseded.length || aside.drafts.length">
          <p class="font-medium text-default">
            Карты есть, но в картину не входит ни одна.
          </p>
          <p v-if="aside.superseded.length" class="mt-2">
            {{ plural(aside.superseded.length, "карта помечена", "карты помечены", "карт помечены") }}
            заменёнными: <span class="font-mono">{{ aside.superseded.map((record) => record.id).join(", ") }}</span>.
            Карта — это изменение, а не снимок: картина складывается из суммы подтверждённых.
            Пометив прежние заменёнными, вы вычли их из суммы.
          </p>
          <p v-if="aside.drafts.length" class="mt-2">
            {{ plural(aside.drafts.length, "карта ждёт", "карты ждут", "карт ждут") }} подтверждения:
            <span class="font-mono">{{ aside.drafts.map((record) => record.id).join(", ") }}</span>.
          </p>
        </template>

        <template v-else>
          Подтверждённых карт нет — складывать нечего. Карта заводится записью типа
          <code>map</code> и запрашивается у модели по шаблону из <code>docs/prompts/</code>.
        </template>
      </div>

      <template v-else-if="map">
        <!-- Подвкладка на вид карты: у каждой свой смысл (вопрос, на который
             она отвечает), а не просто разные данные под одной кнопкой. -->
        <UTabs
          v-model="shown"
          :items="views.map((view) => ({ label: view.title, value: view.key, badge: view.count }))"
        />

        <!-- Общий контейнер диаграммы и карточки узла: на весь экран
             разворачивается он, а не сама диаграмма, — иначе карточка (портал
             рядом) из фуллскрина не видна (docs/04-ui.md, «Карты»). -->
        <div ref="stage" class="[&:fullscreen]:overflow-auto [&:fullscreen]:bg-default [&:fullscreen]:p-4">
          <UCard v-if="current">
            <template #header>
              <div class="flex flex-wrap items-center gap-3">
                <div>
                  <h2 class="font-medium">{{ current.title }}</h2>
                  <p class="text-sm text-muted">{{ current.question }}</p>
                </div>
                <!-- У функциональной карты свой переключатель режима — дерево или тот же mermaid-граф, что у остальных видов. -->
                <UTabs
                  v-if="current.key === 'functional'"
                  v-model="functionalView"
                  class="ml-auto w-40"
                  size="xs"
                  :items="[{ label: 'Дерево', value: 'tree' }, { label: 'Граф', value: 'graph' }]"
                />
                <template v-else>
                  <!-- Группы или все модули разом — у кодовой базы (docs/04-ui.md, «Группы кодовой карты»). -->
                  <div v-if="current.key === 'codemap' && grouping && grouping.groups.length >= 2" class="ml-auto flex gap-1">
                    <UButton
                      size="xs"
                      :variant="codemapMode === 'all' ? 'outline' : 'solid'"
                      color="neutral"
                      icon="i-lucide-boxes"
                      @click="showGroups"
                    >
                      Группы
                    </UButton>
                    <UButton
                      size="xs"
                      :variant="codemapMode === 'all' ? 'solid' : 'outline'"
                      color="neutral"
                      icon="i-lucide-network"
                      @click="showAllModules"
                    >
                      Все модули
                    </UButton>
                  </div>
                  <UTabs
                    v-model="viewMode"
                    :class="current.key === 'codemap' && grouping && grouping.groups.length >= 2 ? 'w-40' : 'ml-auto w-40'"
                    size="xs"
                    :items="[{ label: '2D', value: '2d' }, { label: '3D', value: '3d' }]"
                  />
                </template>
                <!-- Число уже видно бейджем на вкладке — здесь дублировать незачем. -->
                <UButton
                  v-if="current.text && (current.key === 'functional' ? functionalView === 'graph' : viewMode === '2d')"
                  size="sm"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-copy"
                  @click="copySource"
                >
                  {{ copied ? 'Скопировано' : 'Скопировать mermaid' }}
                </UButton>
              </div>
            </template>

            <template v-if="shown === 'codemap' && codemapMode === 'groups'">
              <p class="mb-3 text-sm text-muted">
                Группы выведены из путей к файлам; стрелка — сколько импортов идёт из одной группы в другую.
                Клик — карточка группы, двойной клик — открыть её целиком.
              </p>
            </template>

            <template v-if="shown === 'codemap' && codemapMode === 'group' && openGroupInfo">
              <div class="mb-3 space-y-1 text-sm">
                <p class="flex flex-wrap items-center gap-1">
                  <UButton size="xs" variant="link" color="neutral" icon="i-lucide-chevron-left" @click="showGroups">
                    Все группы
                  </UButton>
                  <span class="text-muted">›</span>
                  <span class="font-medium">{{ openGroupInfo.title }}</span>
                  <UBadge v-if="openGroupInfo.auto" size="xs" color="neutral" variant="subtle">авто</UBadge>
                  <span class="text-muted">· {{ plural(openGroupInfo.moduleCount, 'модуль', 'модуля', 'модулей') }}</span>
                </p>
                <p v-if="openGroupInfo.dependsOn.length || openGroupInfo.usedBy.length" class="flex flex-wrap items-center gap-x-1 text-xs text-muted">
                  <template v-if="openGroupInfo.dependsOn.length">
                    Зависит от:
                    <button
                      v-for="item in openGroupInfo.dependsOn"
                      :key="item.groupId"
                      type="button"
                      class="mr-1 text-default hover:underline"
                      @click="enterGroup(item.groupId)"
                    >{{ item.title }}</button>
                  </template>
                  <template v-if="openGroupInfo.usedBy.length">
                    · Используют:
                    <button
                      v-for="item in openGroupInfo.usedBy"
                      :key="item.groupId"
                      type="button"
                      class="mr-1 text-default hover:underline"
                      @click="enterGroup(item.groupId)"
                    >{{ item.title }}</button>
                  </template>
                </p>
                <p class="text-xs text-muted">
                  Толстая рамка — порт: у модуля есть связи за пределами группы. Выберите модуль, чтобы увидеть, куда они ведут.
                </p>
              </div>
            </template>

            <!-- Слои — только у кодовой базы: у остальных видов узел не несёт слоя. На обзоре групп их нет. -->
            <template v-if="shown === 'codemap' && codemapMode !== 'groups' && allLayers.length > 1">
              <p v-if="isLargeCodemap && hiddenLayers.size > 0" class="mb-2 text-sm text-muted">
                {{ codemapMode === 'group' ? 'Крупная группа' : 'Крупная кодовая база' }} ({{ scopeCodemap?.modules.length }} модулей) — чтобы не перегружать диаграмму,
                сначала показан один слой. Выберите другой чипом; чтобы увидеть все разом, кликните по выбранному ещё раз.
              </p>
              <div class="mb-3 flex flex-wrap gap-1">
                <UButton
                  v-for="layer in allLayers"
                  :key="layer"
                  size="xs"
                  :color="hiddenLayers.has(layer) ? 'neutral' : 'primary'"
                  :variant="hiddenLayers.has(layer) ? 'outline' : 'subtle'"
                  @click="toggleLayer(layer)"
                >
                  {{ layer }}
                </UButton>
              </div>
            </template>

            <template v-if="shown === 'functional'">
              <PromptPanel
                class="mb-3"
                :project-id="projectId"
                kind="functional-check"
                label="Проверить по коду"
                hint="Модель сама читает код и предлагает состояние — это её мнение, подтверждает человек"
              >
                <template #answer="{ answer }">
                  <FunctionalCheck
                    :project-id="projectId"
                    :answer="answer"
                    @apply="applyChecks"
                  />
                </template>
              </PromptPanel>

              <FunctionalSummary
                v-if="functionalProgress.total > 0"
                v-model:filter="statusFilter"
                :progress="functionalProgress"
              />

              <FunctionalTree
                v-if="functionalView === 'tree'"
                v-model:marks="marks"
                :project-id="projectId"
                :capabilities="functionalEffective.capabilities"
                :saved="map.functional.capabilities"
                :relations="functionalEffective.relations"
                :filter="statusFilter"
                @select="(value) => (selection = value)"
                @changed="() => refresh()"
              />
              <template v-else>
                <p v-if="!current.text" class="text-sm text-muted">
                  {{ map.functional.capabilities.length ? 'Под этот фильтр ничего не подошло.' : 'В подтверждённых картах эта структура не описана.' }}
                </p>
                <template v-else>
                  <!-- Легенда рядом, а не по памяти: цвет — состояние, вид стрелки — вид связи. -->
                  <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                    <span v-for="key in legendKeys" :key="key" class="flex items-center gap-1">
                      <span
                        class="inline-block h-3 w-5 rounded-sm border"
                        :class="key === 'unrated' ? 'border-dashed' : ''"
                        :style="{ backgroundColor: STATUS_STYLE[key].fill, borderColor: STATUS_STYLE[key].stroke }"
                      />
                      {{ IMPL_LABEL[key] }}
                    </span>
                    <span>──→ {{ RELATION_LABEL.depends }}</span>
                    <span>╌╌→ {{ RELATION_LABEL.uses }}</span>
                    <span>══→ {{ RELATION_LABEL.feeds }}</span>
                    <span class="text-warning">жёлтая — ждёт зависимость</span>
                    <span class="text-error">красная — ждут друг друга</span>
                  </div>
                  <MermaidDiagram
                    :source="current.text"
                    :details="current.details"
                    :paths="current.paths"
                    :edges="current.edges"
                    :neighbors="current.neighbors"
                    :pending-ids="pendingNodeIds"
                    :fullscreen-target="stage"
                    :id="`map-${current.key}`"
                    @node-click="onNodeClick"
                    @edge-click="onEdgeClick"
                  />
                </template>
              </template>
            </template>

            <template v-else>
              <p v-if="!current.text" class="text-sm text-muted">
                В подтверждённых картах эта структура не описана.
              </p>
              <MermaidDiagram3D
                v-else-if="viewMode === '3d'"
                :key="scopeKey"
                :nodes="current.nodes"
                :edges="current.edges"
                :fullscreen-target="stage"
                :id="`map-${current.key}-3d`"
                @node-click="onNodeClick"
                @edge-click="onEdgeClick"
              />
              <!-- Ключ — область (все / группы / одна группа): другая область — новый вид, а выбор модуля внутри
                   области перерисовывает диаграмму, не сбрасывая масштаб. -->
              <MermaidDiagram
                v-else
                :key="shown === 'codemap' ? scopeKey : shown"
                :source="current.text"
                :details="current.details"
                :paths="current.paths"
                :edges="current.edges"
                :neighbors="current.neighbors"
                :pending-ids="pendingNodeIds"
                :ghost-ids="ghostNodeIds"
                :focus-key="shown === 'codemap' && ghostFor ? moduleNodeId(ghostFor) : null"
                :keep-view="true"
                :fullscreen-target="stage"
                :id="`map-${current.key}`"
                @node-click="onNodeClick"
                @node-dblclick="onNodeDblClick"
                @background-click="onBackgroundClick"
                @edge-click="onEdgeClick"
              />
            </template>
          </UCard>

          <MapInspector
            :project-id="projectId"
            :selection="selection"
            :to="staged ? stage : null"
            @close="onBackgroundClick"
            @open-group="enterGroup"
          />
        </div>
      </template>
    </template>
  </div>
</template>
