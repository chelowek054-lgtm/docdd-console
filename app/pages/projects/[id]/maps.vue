<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { MapSelection, MermaidEdge } from '~/utils/map-mermaid';
import { summarize, visibleUnder, type CapabilityState, type CapabilityStatus, type RelationKind } from '~~/server/lib/functional';
import type { ProjectMap } from '~~/server/lib/maps';

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
 * Кодовая база показывается тремя уровнями: обзор групп, группа, выбранный
 * модуль (docs/04-ui.md, «Группы кодовой карты»). Состояние — в композабле:
 * режим, открытая группа (она же в адресе), выбранный модуль и слои. Слои и
 * порог крупной базы работают как прежде, но на том, что сейчас в области
 * просмотра: на группе, а не на всём проекте.
 */
const codeGroups = useCodeGroups(map);
const {
  model: groupModel, modulesById, capabilities, ungrouped, mode: codeMode, groupsAvailable, openGroup, focus,
  chooseMode, setOpenGroup, allLayers, isLarge: isLargeCodemap, hiddenLayers, toggleLayer,
  filteredCodemap, scopeCount
} = codeGroups;

/**
 * Потоки данных строятся по тем же группам: обзор «группы ↔ хранилища и внешние
 * системы», а внутри группы или свёртки источников — нынешняя детализация.
 */
const {
  mode: flowMode, openBucket, open: openFlow, chooseMode: chooseFlowMode, view: flowView
} = useFlowGroups(map, codeGroups);

function onFlowMode(value: unknown) {
  void chooseFlowMode(value === 'flows' ? 'flows' : 'groups');
}

function onMode(value: unknown) {
  void chooseMode(value === 'modules' ? 'modules' : 'groups');
}

function codemapView(value: MapResponse) {
  if (codeMode.value === 'modules') {
    return codemapMermaid({ ...value, codemap: filteredCodemap.value ?? value.codemap });
  }
  if (!openGroup.value) return groupsOverviewMermaid(groupModel.value, modulesById.value, capabilities.value);
  return groupMermaid(value.codemap, groupModel.value, openGroup.value, {
    hiddenLayers: hiddenLayers.value,
    focus: focus.value,
    capabilities: capabilities.value
  });
}

const openGroupInfo = computed(() => groupModel.value.groups.find((group) => group.id === openGroup.value));

/** Обзор потоков (а не детализация внутри группы или свёртки и не «все потоки разом»). */
const flowOverview = computed(() => flowMode.value === 'groups' && !openGroup.value && !openBucket.value);

/** Узлы обзора потоков списком: рядом с диаграммой, чтобы открыть группу или посмотреть её карточку без клика по узлу. */
const flowOverviewItems = computed(() => (shown.value === 'dataflow' && flowOverview.value
  ? Object.values(current.value?.nodes ?? {}).filter((node) => node.group || node.bucket)
  : []));

/** Название того, что открыто на экране потоков: группа кода или свёртка источников. */
const flowScopeTitle = computed(() => openBucket.value ?? openGroupInfo.value?.title ?? null);

/** Карточка группы: «О группе» на экране группы и список групп под обзором. */
function showGroupCard(id: string) {
  const group = groupModel.value.groups.find((item) => item.id === id);
  if (!group) return;
  selection.value = {
    kind: 'node', id: group.id, title: group.title, summary: group.summary,
    group: groupCardOf(groupModel.value, group, modulesById.value, capabilities.value)
  };
}

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
 * Фильтр по состоянию у графа: свой, у дерева — свой (внутри `FunctionalTree`).
 * Рисуются только найденные возможности и их предки, а счёт считается по всей
 * карте (docs/04-ui.md, «Функциональная карта»).
 */
const graphFilter = ref<CapabilityState | null>(null);
const functionalSummary = computed(() => summarize(map.value?.functional.capabilities ?? []));
const graphVisible = computed(
  () => visibleUnder(map.value?.functional.capabilities ?? [], functionalSummary.value, graphFilter.value)
);

const views = computed(() => {
  const value = map.value;
  if (!value) return [];
  return [
    {
      key: 'codemap',
      title: 'Кодовая база',
      question: 'Из чего состоит проект и что на что опирается',
      count: `${value.codemap.modules.length} модулей, ${value.codemap.imports.length} связей`,
      ...codemapView(value)
    },
    {
      key: 'dataflow',
      title: 'Потоки данных',
      question: 'Откуда данные приходят, где лежат и куда уходят',
      count: `${value.dataflow.sources.length} источников, ${value.dataflow.flows.length} потоков`,
      ...flowView(value)
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
      ...functionalMermaid(value, graphVisible.value)
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
 * специалист, docs/07-maps.md, «Экран: дерево, а не mindmap») или тот же
 * mermaid-граф (`mindmap`), что рисуют и остальные виды карт, для тех, кому
 * привычнее диаграмма. Тексты и узлы уже посчитаны (`functionalMermaid` в
 * `views` выше) — включение режима ничего не пересчитывает.
 */
const functionalView = ref<'tree' | 'graph'>('tree');

/**
 * Отметки из «Проверить по коду» ложатся на дерево несохранёнными. Если читали
 * граф, возвращаем дерево: отметки живут там, и человеку надо их увидеть.
 */
const tree = ref<{
  addMarks: (marks: { id: string; status: CapabilityStatus; note?: string }[]) => void;
  openRelate: (id: string) => void;
  removeRelation: (relation: { from: string; to: string; kind: RelationKind }) => Promise<void>;
} | null>(null);
async function applyChecked(marks: { id: string; status: CapabilityStatus; note?: string }[]) {
  if (functionalView.value !== 'tree') {
    functionalView.value = 'tree';
    await nextTick();
  }
  tree.value?.addMarks(marks);
}

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
  if (shown.value === 'dataflow' && flowOverview.value) {
    // Обзор потоков: узел-группа и узел-свёртка ведут внутрь, как на кодовой базе.
    if (node.group) {
      void openFlow({ group: node.group.id });
      return;
    }
    if (node.bucket) {
      void openFlow({ bucket: node.bucket.id });
      return;
    }
  }
  if (shown.value === 'codemap' && codeMode.value === 'groups') {
    // Узел обзора и узел-группа по краям ведут внутрь группы; модуль группы
    // становится выбранным, и его соседи из других групп показываются призраками.
    if (node.group) {
      void setOpenGroup(node.group.id);
      return;
    }
    if (openGroup.value && !node.ghostOf) focus.value = node.id;
  }
  selection.value = { kind: 'node', ...node };
}

/** Клик мимо узлов снимает выбор модуля: призраки пропадают, внешние связи сворачиваются обратно. */
function onBlankClick() {
  if (focus.value !== null) focus.value = null;
}
function onEdgeClick(edge: MermaidEdge) {
  if (edge.groupLink) {
    // Свёрнутая стрелка между группами: карточка раскрывает её в исходные импорты со свидетельствами.
    selection.value = { kind: 'group-link', ...edge.groupLink, declaredBy: edge.declaredBy };
    return;
  }
  if (edge.relation) {
    // Связь возможностей — без свидетельства: карточка показывает смысл, а не строку кода.
    const nodes = current.value?.nodes ?? {};
    selection.value = {
      kind: 'relation',
      relationKind: edge.relation.kind,
      summary: edge.relation.summary,
      fromId: edge.relation.fromId,
      toId: edge.relation.toId,
      cycle: edge.relation.cycle,
      fromTitle: nodes[edge.from]?.title,
      toTitle: nodes[edge.to]?.title,
      declaredBy: edge.declaredBy,
      pending: edge.pending
    };
    return;
  }
  if (!edge.evidence) return;
  selection.value = { kind: 'edge', evidence: edge.evidence, status: edge.status, declaredBy: edge.declaredBy };
}

/**
 * «Связать» и «Убрать связь» в карточке: форма и черновик живут в дереве, как
 * и у любой другой правки функциональной карты, — карточка просит дерево их
 * открыть (docs/04-ui.md).
 */
async function showTree() {
  selection.value = null;
  if (functionalView.value !== 'tree') {
    functionalView.value = 'tree';
    await nextTick();
  }
}
async function onRelate(id: string) {
  await showTree();
  tree.value?.openRelate(id);
}
async function onUnrelate(relation: { from: string; to: string; kind: RelationKind }) {
  await showTree();
  await tree.value?.removeRelation(relation);
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

      <!-- Группировка — тем же путём, что «Разбить на фазы»: запрос показывается целиком, ответ ложится
           черновиком карты и ждёт человека (docs/04-ui.md, «Группы кодовой карты»). -->
      <PromptPanel
        v-if="map && map.codemap.modules.length > 0"
        :project-id="projectId"
        kind="groups"
        :label="`Сгруппировать модули: ${ungrouped}`"
        :disabled="ungrouped === 0"
        disabled-reason="Все модули уже в группах — группировать нечего"
        hint="Ответ сохраняется черновиком карты и требует подтверждения"
        @answered="onAnswer"
      >
        <template #answer="{ answer }">
          <div class="mb-3 flex flex-wrap items-center gap-3">
            <UButton size="sm" :loading="saving" @click="saveDraft(answer)">Сохранить черновиком</UButton>
            <NuxtLink v-if="draftId" :to="`/projects/${projectId}/records/${draftId}`" class="text-sm hover:underline">
              Черновик {{ draftId }} создан — открыть
            </NuxtLink>
            <UAlert
              v-if="draftFailure"
              color="error"
              variant="subtle"
              :title="draftFailure.message"
              :description="problems.join(' ')"
            />
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
                <!-- Кодовая база: группы (обзор → группа → модуль) или все модули разом. -->
                <UTabs
                  v-if="current.key === 'codemap' && groupsAvailable"
                  :model-value="codeMode"
                  class="ml-auto w-56"
                  size="xs"
                  :items="[{ label: 'Группы', value: 'groups' }, { label: 'Все модули', value: 'modules' }]"
                  @update:model-value="onMode"
                />
                <!-- Потоки данных: по группам (обзор → группа или свёртка источников) или все потоки разом. -->
                <UTabs
                  v-if="current.key === 'dataflow' && groupsAvailable"
                  :model-value="flowMode"
                  class="ml-auto w-56"
                  size="xs"
                  :items="[{ label: 'Группы', value: 'groups' }, { label: 'Все потоки', value: 'flows' }]"
                  @update:model-value="onFlowMode"
                />
                <!-- У функциональной карты свой переключатель режима — дерево или граф состояния. -->
                <UTabs
                  v-if="current.key === 'functional'"
                  v-model="functionalView"
                  class="ml-auto w-40"
                  size="xs"
                  :items="[{ label: 'Дерево', value: 'tree' }, { label: 'Граф', value: 'graph' }]"
                />
                <UTabs
                  v-else
                  v-model="viewMode"
                  class="ml-auto w-40"
                  size="xs"
                  :items="[{ label: '2D', value: '2d' }, { label: '3D', value: '3d' }]"
                />
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

            <!-- Кодовая база по группам: обзор → группа → выбранный модуль (docs/04-ui.md, «Группы кодовой карты»). -->
            <template v-if="shown === 'codemap' && codeMode === 'groups'">
              <div v-if="openGroupInfo" class="mb-3 flex flex-wrap items-center gap-2">
                <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-arrow-left" @click="setOpenGroup(null)">
                  Все группы
                </UButton>
                <span class="font-medium">{{ openGroupInfo.title }}</span>
                <UBadge v-if="openGroupInfo.auto" size="xs" color="neutral" variant="subtle">авто</UBadge>
                <span class="text-sm text-muted">{{ plural(openGroupInfo.modules.length, 'модуль', 'модуля', 'модулей') }}</span>
                <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-info" @click="showGroupCard(openGroupInfo.id)">
                  О группе
                </UButton>
                <span v-if="focus" class="text-sm text-muted">
                  Выбран модуль — соседи из других групп показаны призраками. Клик в пустое место снимает выбор.
                </span>
              </div>
              <div v-else class="mb-3 space-y-2">
                <p class="text-sm text-muted">
                  Обзор: {{ plural(groupModel.groups.length, 'группа', 'группы', 'групп') }}. Клик по группе открывает её,
                  клик по стрелке показывает свёрнутые импорты со свидетельствами.
                </p>
                <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <li v-for="group in groupModel.groups" :key="group.id" class="inline-flex items-center gap-1">
                    <button type="button" class="hover:underline" @click="setOpenGroup(group.id)">{{ group.title }}</button>
                    <span class="text-muted">{{ group.modules.length }}</span>
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-info"
                      :aria-label="`О группе ${group.title}`"
                      @click="showGroupCard(group.id)"
                    />
                  </li>
                </ul>
              </div>
            </template>

            <!-- Потоки по группам: обзор → группа кода или свёртка источников (docs/04-ui.md). -->
            <template v-if="shown === 'dataflow' && flowMode === 'groups'">
              <div v-if="flowScopeTitle" class="mb-3 flex flex-wrap items-center gap-2">
                <UButton size="xs" variant="soft" color="neutral" icon="i-lucide-arrow-left" @click="openFlow()">
                  Все группы
                </UButton>
                <span class="font-medium">{{ flowScopeTitle }}</span>
                <UBadge size="xs" color="neutral" variant="subtle">{{ openBucket ? 'свёртка источников' : 'группа кода' }}</UBadge>
                <UButton
                  v-if="openGroupInfo"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-info"
                  @click="showGroupCard(openGroupInfo.id)"
                >
                  О группе
                </UButton>
              </div>
              <div v-else class="mb-3 space-y-2">
                <p class="text-sm text-muted">
                  Обзор: кто читает и пишет где. Клик по группе или по свёртке источников открывает её детали,
                  клик по стрелке показывает свёрнутые потоки со свидетельствами.
                </p>
                <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <li v-for="item in flowOverviewItems" :key="item.id + (item.bucket ? 'b' : 'g')" class="inline-flex items-center gap-1">
                    <button
                      type="button"
                      class="hover:underline"
                      @click="openFlow(item.bucket ? { bucket: item.id } : { group: item.id })"
                    >{{ item.title ?? item.id }}</button>
                    <UBadge size="xs" color="neutral" variant="subtle">{{ item.bucket ? 'источники' : 'код' }}</UBadge>
                    <UButton
                      size="xs"
                      variant="ghost"
                      color="neutral"
                      icon="i-lucide-info"
                      :aria-label="`О ${item.title ?? item.id}`"
                      @click="selection = { kind: 'node', ...item }"
                    />
                  </li>
                </ul>
              </div>
            </template>

            <!-- Слои — только у кодовой базы: у остальных видов узел не несёт слоя. -->
            <template v-if="shown === 'codemap' && allLayers.length > 1">
              <p v-if="isLargeCodemap && hiddenLayers.size > 0" class="mb-2 text-sm text-muted">
                Крупная кодовая база ({{ scopeCount }} модулей) — чтобы не перегружать диаграмму,
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
                hint="Модель сама читает код — ответ ничего не подтверждает, это её мнение"
              >
                <!-- Ответ разбирается в таблицу «сейчас → по мнению модели»; применяет её человек. -->
                <template #answer="{ answer }">
                  <FunctionalCheck :project-id="projectId" :answer="answer" @apply="applyChecked" />
                </template>
              </PromptPanel>
              <FunctionalTree
                v-if="functionalView === 'tree'"
                ref="tree"
                :project-id="projectId"
                :capabilities="map.functional.capabilities"
                :relations="map.functional.relations"
                @select="(value) => (selection = value)"
                @changed="() => refresh()"
              />
              <template v-else>
                <FunctionalSummary
                  :tally="functionalSummary.overall"
                  :filter="graphFilter"
                  @filter="(state) => (graphFilter = state)"
                />
                <FunctionalLegend class="mb-3" />
                <p v-if="!current.text" class="text-sm text-muted">
                  В подтверждённых картах эта структура не описана.
                </p>
                <MermaidDiagram
                  v-else
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

            <template v-else>
              <p v-if="!current.text && shown === 'dataflow' && flowScopeTitle" class="text-sm text-muted">
                У «{{ flowScopeTitle }}» нет потоков данных в подтверждённых картах.
              </p>
              <p v-else-if="!current.text" class="text-sm text-muted">
                В подтверждённых картах эта структура не описана.
              </p>
              <MermaidDiagram3D
                v-else-if="viewMode === '3d'"
                :nodes="current.nodes"
                :edges="current.edges"
                :fullscreen-target="stage"
                :id="`map-${current.key}-3d`"
                @node-click="onNodeClick"
                @edge-click="onEdgeClick"
              />
              <MermaidDiagram
                v-else
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
                @blank-click="onBlankClick"
              />
            </template>
          </UCard>

          <MapInspector
            :project-id="projectId"
            :selection="selection"
            :to="staged ? stage : null"
            @close="selection = null"
            @relate="onRelate"
            @unrelate="onUnrelate"
          />
        </div>
      </template>
    </template>
  </div>
</template>
