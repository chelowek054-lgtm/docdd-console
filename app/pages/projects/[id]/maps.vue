<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { MapSelection, MermaidEdge } from '~/utils/map-mermaid';
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
    await refresh();
  } finally {
    saving.value = false;
  }
}

function onAnswer() {
  draftId.value = '';
  draftFailure.value = null;
  fixed.value = '';
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
 * Слои кодовой базы — чекбоксы «скрыть», а не «показать»: по умолчанию видно
 * всё, скрытые запоминаются по имени слоя, а не по индексу — переживают
 * «Обновить карты» и новые слои сами не пропадают из списка.
 */
const allLayers = computed(() => {
  const set = new Set<string>();
  for (const item of map.value?.codemap.modules ?? []) set.add(item.layer ?? 'без слоя');
  return [...set].sort();
});
const hiddenLayers = ref<Set<string>>(new Set());
function toggleLayer(layer: string) {
  const next = new Set(hiddenLayers.value);
  if (next.has(layer)) next.delete(layer);
  else next.add(layer);
  hiddenLayers.value = next;
}

/** Кодовая база с вычетом скрытых слоёв — рёбра к спрятанному модулю тоже прячутся. */
const filteredCodemap = computed(() => {
  const value = map.value;
  if (!value || hiddenLayers.value.size === 0) return value?.codemap;
  const visible = new Set(
    value.codemap.modules.filter((item) => !hiddenLayers.value.has(item.layer ?? 'без слоя')).map((item) => item.id)
  );
  return {
    modules: value.codemap.modules.filter((item) => visible.has(item.id)),
    imports: value.codemap.imports.filter((edge) => visible.has(edge.from) && visible.has(edge.to))
  };
});

const views = computed(() => {
  const value = map.value;
  if (!value) return [];
  return [
    {
      key: 'codemap',
      title: 'Кодовая база',
      question: 'Из чего состоит проект и что на что опирается',
      count: `${value.codemap.modules.length} модулей, ${value.codemap.imports.length} связей`,
      ...codemapMermaid({ ...value, codemap: filteredCodemap.value ?? value.codemap })
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
      ...functionalMermaid(value)
    }
  ];
});

const shown = ref<'codemap' | 'dataflow' | 'userflow' | 'functional'>('codemap');
const current = computed(() => views.value.find((view) => view.key === shown.value));

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
  selection.value = { kind: 'node', ...node };
}
function onEdgeClick(edge: MermaidEdge) {
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
                <!-- Число уже видно бейджем на вкладке — здесь дублировать незачем. -->
                <UButton
                  v-if="current.text"
                  class="ml-auto"
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

            <!-- Слои — только у кодовой базы: у остальных видов узел не несёт слоя. -->
            <div v-if="shown === 'codemap' && allLayers.length > 1" class="mb-3 flex flex-wrap gap-1">
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
              :fullscreen-target="stage"
              :id="`map-${current.key}`"
              @node-click="onNodeClick"
              @edge-click="onEdgeClick"
            />
          </UCard>

          <MapInspector
            :project-id="projectId"
            :selection="selection"
            :to="staged ? stage : null"
            @close="selection = null"
          />
        </div>
      </template>
    </template>
  </div>
</template>
