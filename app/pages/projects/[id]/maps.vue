<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ArchViolationView, FunctionalMode, MapSelection, MermaidEdge } from '~/utils/map-mermaid';
import { capabilityViews } from '~/utils/functional-view';
import {
  NO_RELATION_MARKS,
  groupLevel,
  overallProgress,
  queueRelationAdd,
  queueRelationRemove,
  relationMarkCount,
  withMarks,
  withRelationMarks,
  type CapabilityCoverage,
  type Horizon,
  type ImplStatus,
  type Mark,
  type Priority,
  type RelationItem,
  type RelationMarks,
  type StatusFilter
} from '~~/server/lib/functional';
import {
  codeGroupScope,
  flowContext,
  flowGhosts,
  groupFlows,
  codeGroupOf,
  kindScope,
  type FlowItem
} from '~~/server/lib/flow-groups';
import { ghostNeighbors, groupCard, groupModules, groupScope, portsOf } from '~~/server/lib/groups';
import { layerOf } from '~~/server/lib/layers';
import type { ProjectMap } from '~~/server/lib/maps';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

type MapResponse = ProjectMap & { unverified: number };

const { data, refresh: refreshMap, status } = useFetch<MapResponse | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/map`,
  { key: () => `map:${projectId.value}` }
);

/** Что стоит за возможностями в процессе — отдельный запрос: ему нужны требования, задачи и отчёты (docs/03-server-api.md). */
const { data: coverageData, refresh: refreshCoverage } = useFetch<{ coverage: Record<string, CapabilityCoverage> } | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/map/coverage`,
  { key: () => `coverage:${projectId.value}` }
);
const coverage = computed(() => (coverageData.value && 'coverage' in coverageData.value ? coverageData.value.coverage : undefined));

interface ArchitectureResponse {
  enabled: boolean;
  findings?: { code: string; from: string; to: string; message: string; evidence?: { path: string; line: number }; map?: string }[];
  checked?: number;
  total?: number;
  unchecked?: Record<string, number>;
  reconcile?: { enabled: boolean; modulesWithoutCapability: string[]; capabilitiesWithoutModule: { id: string; title: string }[] };
}

/** Нарушения архитектуры по подтверждённой карте кода (docs/03-server-api.md, `GET /architecture`). */
const { data: architectureData, refresh: refreshArchitecture } = useFetch<ArchitectureResponse | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/architecture`,
  { key: () => `architecture:${projectId.value}` }
);
const architecture = computed(() => (architectureData.value && 'enabled' in architectureData.value ? architectureData.value : undefined));

/** Стрелкой рисуются нарушения; подсказка «поднять» (`arch_promote`) — только строкой над схемой. */
const violations = computed<ReadonlyMap<string, ArchViolationView>>(() => {
  const found = new Map<string, ArchViolationView>();
  for (const item of architecture.value?.findings ?? []) {
    if (item.code === 'arch_promote') continue;
    const key = violationKey(item.from, item.to);
    if (!found.has(key)) found.set(key, { code: item.code, message: item.message });
  }
  return found;
});

/** Перечитать карту, покрытие и архитектуру вместе: подтверждённая карта или отметка меняет все три. */
async function refresh() {
  await Promise.all([refreshMap(), refreshCoverage(), refreshArchitecture()]);
}

const saving = ref(false);
const draftId = ref('');
const draftFailure = ref<ApiFailure | null>(null);
const creatingTask = ref(false);
const taskId = ref('');
/** Ответ, поправленный моделью: заменяет прошлый, пока его не сохранили. */
const fixed = ref('');

const { running: fixing, elapsed, outcome, log, stream, cancel } = useModelRequest(() => `${projectId.value}:map-fix`, {
  label: 'Поправить ответ по картам',
  onRecovered: (answer) => acceptFix(answer as { answer: string })
});

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

  acceptFix(result);
}

function acceptFix(result: { answer: string }) {
  fixed.value = result.answer;
  draftFailure.value = null;
}

/** Ответ модели сохраняется черновиком: подтверждает человек, а не приложение. */
async function saveDraft(answer: string, title?: string) {
  saving.value = true;
  draftFailure.value = null;
  draftId.value = '';
  try {
    const response = await $fetch(`/api/projects/${projectId.value}/map/draft`, {
      method: 'POST',
      body: { answer, ...(title ? { title } : {}) },
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
  // Объявленные картой группы сильнее автоматических (docs/07-maps.md).
  return value ? groupModules(value.codemap.modules, value.codemap.imports, value.codemap.groups) : null;
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

/** id → название возможности функциональной карты: карточка группы называет, какую возможность она реализует. */
const capabilityTitles = computed(() => Object.fromEntries(
  (map.value?.functional.capabilities ?? []).map((item) => [item.id, item.title ?? item.id])
));

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

/**
 * Группы на потоках данных (docs/07-maps.md, «Потоки данных», «Группы и
 * здесь»): группы кода те же, что у кодовой карты, источники — по `kind`.
 * Те же три уровня экрана: обзор «группы кода ↔ виды источников», группа кода
 * или вид источников целиком, выбранный узел с соседями из других групп.
 * В адресе — `fview`, `fgroup` (группа кода), `fkind` (вид источников).
 */
const flowCtx = computed(() => {
  const value = map.value;
  return value && grouping.value ? flowContext(grouping.value, value.userflow.screens, value.dataflow.sources) : null;
});
const flowGrouping = computed(() => (flowCtx.value && map.value ? groupFlows(map.value.dataflow.flows, flowCtx.value) : null));

/** Больше стольких узлов (модули «откуда» и источники) — обзор, а не всё разом; хватает двух групп кода. */
const flowMode = computed<'groups' | 'code' | 'kind' | 'all'>(() => {
  const found = flowGrouping.value;
  if (!found || found.links.length === 0) return 'all';
  if (found.codeGroups.some((group) => group.id === String(route.query['fgroup'] ?? ''))) return 'code';
  if (found.kinds.some((item) => item.kind === String(route.query['fkind'] ?? ''))) return 'kind';
  const wanted = String(route.query['fview'] ?? '');
  if (wanted === 'all' || found.codeGroups.length < 2) return 'all';
  if (wanted === 'groups') return 'groups';
  const value = map.value;
  const nodes = new Set([...(value?.dataflow.flows ?? []).map((flow) => flow.from), ...(value?.dataflow.sources ?? []).map((source) => source.id)]);
  return nodes.size > GROUPED_CODEMAP ? 'groups' : 'all';
});
const flowGroupId = computed(() => (flowMode.value === 'code' ? String(route.query['fgroup']) : ''));
const flowKindId = computed(() => (flowMode.value === 'kind' ? String(route.query['fkind']) : ''));
const flowScopeKey = computed(() => `${flowMode.value}:${flowGroupId.value}:${flowKindId.value}`);
const flowCanSwitch = computed(() => (flowGrouping.value?.codeGroups.length ?? 0) >= 2);
const flowGroupTitle = computed(() => flowGrouping.value?.codeGroups.find((group) => group.id === flowGroupId.value)?.title ?? flowGroupId.value);

function goFlow(query: { fview?: string; fgroup?: string; fkind?: string }) {
  selection.value = null;
  ghostFor.value = null;
  void router.push({ query: { ...route.query, fview: undefined, fgroup: undefined, fkind: undefined, ...query } });
}
const showFlowGroups = () => goFlow({ fview: 'groups' });
const showAllFlows = () => goFlow({ fview: 'all' });
function enterFlow(target: { type: 'code' | 'kind'; id: string }) {
  goFlow(target.type === 'code' ? { fgroup: target.id } : { fkind: target.id });
}

/** Что рисует кодовая карта сейчас: все модули или модули одной группы с импортами между ними. */
const scopeCodemap = computed(() => {
  const value = map.value;
  if (!value) return null;
  if (codemapMode.value !== 'group' || !grouping.value) return value.codemap;
  // Модуль, названный только в импорте, — тоже участник группы: со слоем по папке он входит в чипы слоёв наравне с описанными.
  const declared = new Map(value.codemap.modules.map((item) => [item.id, item]));
  const members = grouping.value.byId.get(openGroupId.value)?.members ?? [];
  return {
    modules: members.map((member) => declared.get(member.id) ?? { id: member.id }),
    imports: groupScope(grouping.value, openGroupId.value, value.codemap.imports).imports as typeof value.codemap.imports
  };
});

/** Смена области — повод забыть выбор слоёв: у другой группы свои слои. */
const scopeKey = computed(() => `${codemapMode.value}:${openGroupId.value}`);
watch([scopeKey, flowScopeKey], () => {
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
  for (const item of scopeCodemap.value?.modules ?? []) set.add(layerOf(item));
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
    const layer = layerOf(item);
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
    value.modules.filter((item) => !hiddenLayers.value.has(layerOf(item))).map((item) => item.id)
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
  if (codemapMode.value === 'groups') return groupOverviewMermaid(found, violations.value);

  const base = filteredCodemap.value ?? value.codemap;
  if (codemapMode.value === 'all') return codemapMermaid({ ...value, codemap: base }, { violations: violations.value });

  const selected = ghostFor.value && base.modules.some((item) => item.id === ghostFor.value) ? ghostFor.value : null;
  const near = selected
    ? ghostNeighbors(found, openGroupId.value, selected, value.codemap.modules, value.codemap.imports)
    : { ghosts: [], imports: [] };
  return codemapMermaid({ ...value, codemap: base }, {
    violations: violations.value,
    ports: portsOf(found, openGroupId.value, value.codemap.imports),
    ghosts: near.ghosts,
    ghostImports: near.imports,
    ghostCards: new Map(near.ghosts.flatMap((ghost) => {
      const card = ghost.collapsed ? groupCard(found, ghost.groupId) : null;
      return card ? [[ghost.groupId, card] as const] : [];
    }))
  });
});

/** Источники и потоки открытой группы кода или вида источников. */
const flowScopeValue = computed(() => {
  const value = map.value;
  const ctx = flowCtx.value;
  if (!value || !ctx) return null;
  if (flowMode.value === 'code') return codeGroupScope(ctx, flowGroupId.value, value.dataflow.flows);
  if (flowMode.value === 'kind') return kindScope(ctx, flowKindId.value, value.dataflow.flows);
  return null;
});

const dataflowView = computed(() => {
  const value = map.value;
  const ctx = flowCtx.value;
  const found = flowGrouping.value;
  if (!value || !ctx || !found || flowMode.value === 'all') return null;

  if (flowMode.value === 'groups') {
    const cards = new Map(found.codeGroups.flatMap((group) => {
      const card = grouping.value ? groupCard(grouping.value, group.id) : null;
      return card ? [[group.id, card] as const] : [];
    }));
    return flowOverviewMermaid(found, cards);
  }

  const scope = flowScopeValue.value;
  if (!scope) return null;
  const restricted = (flows: FlowItem[]) => ({ ...value, dataflow: { sources: scope.sources as typeof value.dataflow.sources, flows: flows as typeof value.dataflow.flows } });

  if (flowMode.value === 'kind') {
    // Группы кода, что трогают источники этого вида: по одному узлу и одному потоку на источник, а не каждый модуль.
    const seen = new Set<string>();
    const rewritten = scope.flows.flatMap((flow) => {
      const groupId = codeGroupOf(flow.from, ctx);
      const title = found.codeGroups.find((group) => group.id === groupId)?.title ?? groupId;
      const key = `${title}>${flow.to}>${flow.direction}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...flow, from: title }];
    });
    return dataflowMermaid(restricted(rewritten));
  }

  const selected = ghostFor.value
    && (scope.flows.some((flow) => flow.from === ghostFor.value) || scope.sources.some((source) => source.id === ghostFor.value))
    ? ghostFor.value
    : null;
  const near = selected
    ? flowGhosts(ctx, flowGroupId.value, selected, value.dataflow.flows)
    : { ghosts: [], flows: [] };
  return dataflowMermaid(restricted(scope.flows), {
    selectableFrom: true,
    ghosts: near.ghosts,
    ghostFlows: near.flows,
    ghostCards: new Map(near.ghosts.flatMap((ghost) => {
      const card = ghost.collapsed && grouping.value ? groupCard(grouping.value, ghost.groupId) : null;
      return card ? [[ghost.groupId, card] as const] : [];
    }))
  });
});

/** Выбранный узел группы кода — по нему диаграмма держит фокус. */
const flowFocusKey = computed(() => {
  const id = ghostFor.value;
  if (!id || flowMode.value !== 'code' || !map.value) return null;
  return map.value.dataflow.sources.some((source) => source.id === id) ? sourceNodeId(id) : fromNodeId(id);
});

/** Переключатель «Группы» / «Все …» — у кодовой карты и у потоков данных, когда есть из чего выбирать. */
const hasGroupSwitch = computed(() => {
  if (shown.value === 'codemap') return !!grouping.value && grouping.value.groups.length >= 2;
  if (shown.value === 'dataflow') return flowCanSwitch.value;
  return false;
});
const allShown = computed(() => (shown.value === 'dataflow' ? flowMode.value === 'all' : codemapMode.value === 'all'));
const flowKindLabel = computed(() => {
  const labels: Record<string, string> = {
    file: 'файлы', http: 'http', db: 'базы данных', queue: 'очереди', env: 'переменные окружения', memory: 'память процесса'
  };
  return labels[flowKindId.value] ?? (flowKindId.value === 'unknown' ? 'не опознаны' : flowKindId.value);
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
/** Несохранённые связи — пачка на экране, как отметки (docs/04-ui.md, «Связи — тоже пачкой»). */
const relationMarks = ref<RelationMarks>(NO_RELATION_MARKS);
const statusFilter = ref<StatusFilter | null>(null);
const functionalEffective = computed(() => {
  const source = map.value?.functional;
  return {
    capabilities: withMarks(source?.capabilities ?? [], marks.value),
    relations: withRelationMarks(source?.relations ?? [], relationMarks.value)
  };
});
const functionalProgress = computed(() => overallProgress(functionalEffective.value.capabilities));

/**
 * Уровни, режимы и фильтры графа состояния (docs/04-ui.md, «Уровни графа»,
 * «Режимы окраски», «Фильтры»). Уровень, группа и режим живут в адресе —
 * ссылкой можно поделиться; фильтры только на экране.
 */
const GROUPED_FUNCTIONAL = 25;
const functionalGroups = computed(() => groupLevel(functionalEffective.value.capabilities, functionalEffective.value.relations));
const capLevel = computed<'groups' | 'group' | 'all'>(() => {
  const found = functionalGroups.value.groups;
  if (found.some((group) => group.id === String(route.query['capgroup'] ?? ''))) return 'group';
  const wanted = String(route.query['capview'] ?? '');
  if (wanted === 'all' || found.length < 2) return 'all';
  if (wanted === 'groups') return 'groups';
  return functionalProgress.value.total > GROUPED_FUNCTIONAL ? 'groups' : 'all';
});
const capGroupId = computed(() => (capLevel.value === 'group' ? String(route.query['capgroup']) : ''));
const capGroupTitle = computed(() => functionalGroups.value.groups.find((group) => group.id === capGroupId.value)?.title ?? capGroupId.value);

/** Режим окраски; «Покрытие» и «Риски» — только когда покрытие загружено. */
const capMode = computed<FunctionalMode>(() => {
  const wanted = String(route.query['capmode'] ?? '');
  if (wanted === 'order') return 'order';
  return (wanted === 'coverage' || wanted === 'risks') && coverage.value ? wanted : 'state';
});
const capModeModel = computed<FunctionalMode>({
  get: () => capMode.value,
  set: (value) => { void router.replace({ query: { ...route.query, capmode: value === 'state' ? undefined : value } }); }
});

const hiddenKinds = ref<string[]>([]);
const planPriority = ref<Priority | 'none' | null>(null);
const planHorizon = ref<Horizon | 'none' | null>(null);
const onlyRisks = ref(false);
/** Выбранная возможность: от неё — соседи-призраки и влияние. */
const capFocus = ref<string | null>(null);
const impactOn = ref(false);

const kindCounts = computed(() => {
  const counts: Record<string, number> = {};
  for (const relation of functionalEffective.value.relations) counts[relation.type] = (counts[relation.type] ?? 0) + 1;
  return counts;
});

function goCap(query: { capview?: string; capgroup?: string }) {
  selection.value = null;
  void router.push({ query: { ...route.query, capview: undefined, capgroup: undefined, ...query } });
}
const showCapGroups = () => goCap({ capview: 'groups' });
const showCapAll = () => goCap({ capview: 'all' });
const enterCapGroup = (groupId: string) => goCap({ capgroup: groupId });

function removeRelation(relation: { from: string; to: string; type: string }) {
  relationMarks.value = queueRelationRemove(relationMarks.value, relation, map.value?.functional.relations ?? []);
}

/** «Занести связи» из «Предложить связи»: в пачку на экране, не в карту. */
function applyRelations(rows: RelationItem[]) {
  let next = relationMarks.value;
  for (const row of rows) next = queueRelationAdd(next, row, map.value?.functional.relations ?? []);
  relationMarks.value = next;
}

/** Выбрать возможность из списка «Можно начинать»: карточка открывается, как после клика по узлу. */
function selectCapability(id: string) {
  const item = functionalEffective.value.capabilities.find((candidate) => candidate.id === id);
  if (!item) return;
  const view = capabilityViews(functionalEffective.value.capabilities, functionalEffective.value.relations, coverage.value).get(id);
  selection.value = {
    kind: 'node', id, title: item.title, summary: item.summary, note: item.note,
    declaredBy: item.declaredBy, declaredAt: item.declaredAt, declaredByRole: item.declaredByRole,
    pending: item.pending, capability: true, ...(view ? { capabilityView: view } : {})
  };
}


/** «Занести отметки» из «Проверить по коду»: в несохранённые отметки, не в карту. */
function applyChecks(rows: { id: string; status: ImplStatus; note: string }[]) {
  const next = { ...marks.value };
  for (const row of rows) next[row.id] = { status: row.status, note: row.note };
  marks.value = next;
}

/** Закрыть вкладку с несохранёнными отметками — браузер предупредит о потере. */
function warnUnsaved(event: BeforeUnloadEvent) {
  if (Object.keys(marks.value).length === 0 && relationMarkCount(relationMarks.value) === 0) return;
  event.preventDefault();
}
onMounted(() => window.addEventListener('beforeunload', warnUnsaved));
onUnmounted(() => window.removeEventListener('beforeunload', warnUnsaved));

const views = computed(() => {
  const value = map.value;
  if (!value) return [];
  const all = [
    {
      key: 'codemap',
      title: 'Кодовая база',
      question: 'Из чего состоит проект и что на что опирается',
      count: `${value.codemap.modules.length} модулей, ${value.codemap.imports.length} связей`,
      ...(codemapDepth.value ?? codemapView.value ?? codemapMermaid(value))
    },
    {
      key: 'dataflow',
      title: 'Потоки данных',
      question: 'Откуда данные приходят, где лежат и куда уходят',
      count: `${value.dataflow.sources.length} источников, ${value.dataflow.flows.length} потоков`,
      ...(dataflowDepth.value ?? dataflowView.value ?? dataflowMermaid(value))
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
      ...(functionalDepth.value ?? functionalMermaid({ ...value, functional: functionalEffective.value }, statusFilter.value, {
        mode: capMode.value,
        level: capLevel.value,
        group: capGroupId.value || null,
        coverage: coverage.value,
        hiddenKinds: new Set(hiddenKinds.value),
        plan: { priority: planPriority.value, horizon: planHorizon.value },
        onlyRisks: onlyRisks.value,
        legendInside: false,
        selected: capFocus.value,
        impact: impactOn.value
      }))
    }
  ];
  // Функциональная карта — основной источник правды: первая вкладка и открывается
  // по умолчанию (docs/04-ui.md, «Карты»).
  return [...all.filter((view) => view.key === 'functional'), ...all.filter((view) => view.key !== 'functional')];
});

// Ссылка с группой в адресе ведёт на её вкладку, а не на первую (docs/04-ui.md, «Группы кодовой карты»).
const startTab = route.query['fgroup'] || route.query['fkind'] || route.query['fview']
  ? 'dataflow'
  : route.query['group'] || route.query['view'] ? 'codemap' : 'functional';
const shown = ref<'codemap' | 'dataflow' | 'userflow' | 'functional'>(startTab);
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
// Выбранная возможность ведёт соседей-призраков и влияние; призрак выбором не становится.
watch(selection, (value) => {
  if (!value) {
    capFocus.value = null;
    impactOn.value = false;
    return;
  }
  if (value.kind === 'node' && value.capability && !value.ghost && value.capabilityView && capFocus.value !== value.id) {
    capFocus.value = value.id;
    impactOn.value = false;
  }
});
function onNodeClick(id: string) {
  const node = current.value?.nodes?.[id];
  if (!node) return; // Нет метаданных — карте нечего показать (functional map, неизвестный узел).
  // На обзоре узел — группа: карточка группы, а не файла.
  if ((shown.value === 'codemap' && codemapMode.value === 'groups' && node.group)
    || (shown.value === 'dataflow' && flowMode.value === 'groups' && node.group)) {
    selection.value = { kind: 'group', ...(node.group as NonNullable<typeof node.group>) };
    return;
  }
  selection.value = { kind: 'node', ...node };
  // Выбранный модуль открытой группы показывает соседей из других групп; призрак выбором не становится.
  if (shown.value === 'codemap' && codemapMode.value === 'group' && !node.ghost) ghostFor.value = node.id;
  if (shown.value === 'dataflow' && flowMode.value === 'code' && !node.ghost) ghostFor.value = node.id;
}
function onNodeDblClick(id: string) {
  const node = current.value?.nodes?.[id];
  if (shown.value === 'codemap' && codemapMode.value === 'groups' && node?.group) enterGroup(node.group.groupId);
  if (shown.value === 'dataflow' && flowMode.value === 'groups' && node?.flowGroup) enterFlow(node.flowGroup);
  if (shown.value === 'functional' && capLevel.value === 'groups' && node?.capabilityGroup) enterCapGroup(node.capabilityGroup);
}
/** «Открыть группу» из карточки: на потоках — группа кода, на кодовой карте — группа модулей. */
function openGroupFromCard(groupId: string) {
  if (shown.value === 'functional') enterCapGroup(groupId);
  else if (shown.value === 'dataflow') enterFlow({ type: 'code', id: groupId });
  else enterGroup(groupId);
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

// --- глубина карт (ADR-0027, T-0095) ---
// Лежит в конце скрипта: карта M-0001 хранит номера строк-свидетельств выше.
// Без вложенности или без ?depth=/?open= все три computed дают null, и экран
// рисует прежние диаграммы (`?? ` в `views`).
// eslint-disable-next-line import/first
import { visibleAt, type Edge as HierarchyEdge, type TreeNode } from '~~/server/lib/hierarchy';
// eslint-disable-next-line import/first
import { groupTree } from '~~/server/lib/groups';
// eslint-disable-next-line import/first
import { codeTree, foldFlows } from '~~/server/lib/flow-groups';
// eslint-disable-next-line import/first
import { COVERAGE_LABEL, IMPL_LABEL, filterLeaves, isImplStatus, overviewAt, planPredicate } from '~~/server/lib/functional';
// eslint-disable-next-line import/first
import type { LinkCard, MermaidNode } from '~/utils/map-mermaid';

type DepthOutput = ReturnType<typeof functionalMermaid>;

/** Глубина из адреса: уровень от корня (0 — верхние группы) и раскрытая на месте группа. */
function depthParams(treeIds: ReadonlySet<string>): { level: number; open: string | null } | null {
  const wanted = String(route.query['depth'] ?? '');
  const rawOpen = String(route.query['open'] ?? '');
  const open = rawOpen && treeIds.has(rawOpen) ? rawOpen : null;
  const level = wanted === 'all' ? 99 : /^[1-9]$/.test(wanted) ? Number(wanted) - 1 : null;
  if (level === null && open === null) return null;
  // Внутри раскрытой группы уровень считается вниз от неё: меньше одного смысла нет.
  return { level: open ? Math.max(level ?? 1, 1) : level ?? 0, open };
}

const foldId = (prefix: string, id: string) => `${prefix}_${id.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}`;
const foldText = (text: string) => text.replace(/["`]/g, "'").slice(0, 40);

/** Выбранный узел свёрнутой диаграммы: от него — призраки-соседи вне раскрытой группы. */
const foldFocus = ref<string | null>(null);
watch(selection, (value) => {
  if (!value) foldFocus.value = null;
  else if (value.kind === 'node' && !value.ghost) foldFocus.value = value.id;
});

/** Лежит ли узел под раскрытой на месте группой; без раскрытой группы — всё «внутри». */
function underFn(open: string | null, nodes: readonly TreeNode[]): (id: string) => boolean {
  if (!open) return () => true;
  const parent = new Map(nodes.map((node) => [node.id, node.parent]));
  return (id) => {
    let at: string | undefined = id;
    // Счётчик — защита от цикла `parent` в данных проекта.
    for (let guard = 0; at !== undefined && guard < 200; guard += 1) {
      if (at === open) return true;
      at = parent.get(at);
    }
    return false;
  };
}

/** Цвета свёрнутой диаграммы по режимам окраски — те же, что у обычной (map-mermaid.ts, MODE_LOOK). */
const FOLD_LOOK: Record<string, { fill: string; stroke: string; dash?: boolean; width?: number }> = {
  st_implemented: { fill: '#DCFCE7', stroke: '#16A34A' },
  st_partial: { fill: '#FEF3C7', stroke: '#D97706' },
  st_not_implemented: { fill: '#FEE2E2', stroke: '#DC2626' },
  st_unrated: { fill: '#F3F4F6', stroke: '#9CA3AF', dash: true },
  cv_verified: { fill: '#DCFCE7', stroke: '#16A34A' },
  cv_unchecked: { fill: '#ECFCCB', stroke: '#65A30D' },
  cv_no_check: { fill: '#DBEAFE', stroke: '#2563EB' },
  cv_none: { fill: '#F3F4F6', stroke: '#9CA3AF', dash: true },
  cv_failing: { fill: '#FEE2E2', stroke: '#DC2626', width: 3 },
  rk_red: { fill: '#FEE2E2', stroke: '#DC2626', width: 3 },
  rk_orange: { fill: '#FFEDD5', stroke: '#EA580C', width: 2 },
  rk_yellow: { fill: '#FEF3C7', stroke: '#D97706' },
  rk_none: { fill: '#F3F4F6', stroke: '#9CA3AF' },
  or_start: { fill: '#F0FDF4', stroke: '#16A34A', width: 3 },
  or_wait: { fill: '#FEF3C7', stroke: '#D97706' },
  or_done: { fill: '#ECFDF5', stroke: '#86EFAC' },
  or_skip: { fill: '#F3F4F6', stroke: '#9CA3AF', dash: true },
  or_unrated: { fill: '#F3F4F6', stroke: '#9CA3AF', dash: true },
  fold_ghost: { fill: '#FFFFFF', stroke: '#9CA3AF', dash: true }
};
const FOLD_ARROW: Record<string, string> = { depends: '-->', uses: '-.->', feeds: '==>', triggers: '--o', replaces: '--x' };
const FOLD_KIND: Record<string, string> = {
  depends: 'зависит от', uses: 'пользуется', feeds: 'передаёт данные в', triggers: 'запускает', replaces: 'заменяет'
};
const FOLD_RISK: Record<string, string> = {
  red: 'Цикл или падающая проверка', orange: 'Отметка расходится с задачами', yellow: 'Ждёт зависимость', none: 'Без признаков'
};
const FOLD_ORDER: Record<string, string> = {
  start: 'Можно начинать', wait: 'Ждёт зависимость', done: 'Готово', skip: 'Не берём', unrated: 'Не оценено'
};

interface FoldNode {
  key: string;
  title: string;
  size: number;
  expandable: boolean;
  summary?: string | undefined;
  /** Класс окраски (ключ `FOLD_LOOK`) и строки под названием. */
  cls?: string;
  lines?: string[];
  extra?: Partial<MermaidNode>;
}
interface FoldEdge {
  from: string;
  to: string;
  count: number;
  label: string;
  evidence: MermaidEdge['evidence'];
  status?: MermaidEdge['status'];
  arrow?: string;
  link?: LinkCard;
}

/**
 * Свёрнутая диаграмма: узел с числом под ним и стрелка с числом связей на подписи.
 * С `focus` и `inside` соседи выбранного узла из чужих веток рисуются призраками
 * (пунктир), прочие чужие ветки уходят — как у открытой группы кодовой карты.
 */
function foldedDiagram(
  allNodes: readonly FoldNode[],
  allEdges: readonly FoldEdge[],
  unit: string,
  options: { focus?: string | null; inside?: (key: string) => boolean } = {}
): DepthOutput {
  const inside = options.inside ?? (() => true);
  const focus = options.focus && allNodes.some((node) => node.key === options.focus) ? options.focus : null;
  let nodes = allNodes;
  let edges = allEdges;
  const ghosts = new Set<string>();
  if (focus && allNodes.some((node) => !inside(node.key))) {
    const near = new Set<string>([focus]);
    for (const edge of allEdges) {
      if (edge.from === focus) near.add(edge.to);
      if (edge.to === focus) near.add(edge.from);
    }
    nodes = allNodes.filter((node) => inside(node.key) || near.has(node.key));
    for (const node of nodes) if (!inside(node.key)) ghosts.add(node.key);
    const kept = new Set(nodes.map((node) => node.key));
    edges = allEdges.filter((edge) => kept.has(edge.from) && kept.has(edge.to)
      && ((inside(edge.from) && inside(edge.to)) || edge.from === focus || edge.to === focus));
  }
  const lines = ['flowchart LR'];
  const out: DepthOutput = { text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} };
  const used = new Set<string>();
  for (const node of nodes) {
    const id = foldId('d', node.key);
    const ghost = ghosts.has(node.key);
    const tail = [node.expandable ? `${node.size} ${unit}` : '', ...(node.lines ?? [])]
      .filter(Boolean).map((line) => `<br/>${foldText(line)}`).join('');
    const cls = ghost ? 'fold_ghost' : node.cls;
    if (cls) used.add(cls);
    lines.push(`    ${id}["${foldText(node.title)}${tail}"]${cls ? `:::${cls}` : ''}`);
    out.details[id] = node.expandable ? `${node.title}: свёрнуто ${node.size} ${unit}` : node.title;
    out.nodes[id] = {
      id: node.key, title: node.title, ...(node.summary ? { summary: node.summary } : {}), ...node.extra,
      ...(ghost ? { ghost: { groupId: node.key, groupTitle: node.title } } : {})
    };
  }
  for (const edge of edges) {
    const from = foldId('d', edge.from);
    const to = foldId('d', edge.to);
    const text = edge.count > 1 ? `${edge.label} ×${edge.count}` : edge.label;
    lines.push(`    ${from} ${edge.arrow ?? '-->'}|"${foldText(text)}"| ${to}`);
    out.edges.push({
      from, to, evidence: edge.evidence, ...(edge.status ? { status: edge.status } : {}), ...(edge.link ? { link: edge.link } : {})
    });
    (out.neighbors[from] ??= []).push(to);
    (out.neighbors[to] ??= []).push(from);
  }
  for (const cls of used) {
    const look = FOLD_LOOK[cls];
    if (!look) continue;
    const parts = [`fill:${look.fill}`, `stroke:${look.stroke}`, 'color:#111827'];
    if (look.width) parts.push(`stroke-width:${look.width}px`);
    if (look.dash) parts.push('stroke-dasharray:4 3');
    if (cls === 'fold_ghost') parts.push('opacity:0.65');
    lines.push(`    classDef ${cls} ${parts.join(',')};`);
  }
  out.text = lines.join('\n');
  return out;
}

const NO_EVIDENCE = { path: '', line: 0, fragment: '' } as MermaidEdge['evidence'];

const codemapDepth = computed<DepthOutput | null>(() => {
  const value = map.value;
  if (!value) return null;
  const base = filteredCodemap.value ?? value.codemap;
  const tree = groupTree(base.modules, base.imports, value.codemap.groups);
  if (!tree.nodes.some((node) => node.parent)) return null;
  const groupIds = new Set(tree.nodes.map((node) => node.id));
  const params = depthParams(groupIds);
  if (!params) return null;
  // Модуль висит под своей самой глубокой группой; модуль с id группы деревом не дублируется.
  const modules = new Set(base.modules.map((item) => item.id));
  for (const edge of base.imports) { modules.add(edge.from); modules.add(edge.to); }
  const treeNodes = [
    ...tree.nodes.map((node) => ({ id: node.id, parent: node.parent })),
    ...[...modules].filter((id) => !groupIds.has(id)).map((id) => ({ id, parent: tree.groupOf(id) }))
  ];
  const visible = (id: string) => visibleAt(id, treeNodes, params.open, params.level);
  const sizes = new Map<string, number>();
  for (const id of modules) sizes.set(visible(id), (sizes.get(visible(id)) ?? 0) + 1);
  const titles = new Map(tree.nodes.map((node) => [node.id, node]));
  const moduleById = new Map(base.modules.map((item) => [item.id, item]));
  const folded = new Map<string, { from: string; to: string; count: number; evidence: MermaidEdge['evidence'] }>();
  for (const edge of base.imports) {
    const from = visible(edge.from);
    const to = visible(edge.to);
    if (from === to) continue;
    const entry = folded.get(`${from}>${to}`) ?? { from, to, count: 0, evidence: edge.evidence };
    entry.count += 1;
    folded.set(`${from}>${to}`, entry);
  }
  return foldedDiagram(
    [...sizes].map(([key, size]) => ({
      key,
      title: titles.get(key)?.title ?? moduleById.get(key)?.title ?? key,
      size,
      expandable: groupIds.has(key),
      summary: titles.get(key)?.summary ?? moduleById.get(key)?.summary
    })),
    [...folded.values()].map((edge) => ({ ...edge, label: 'импорт' })),
    'модулей',
    { focus: foldFocus.value, inside: underFn(params.open, treeNodes) }
  );
});

const dataflowDepth = computed<DepthOutput | null>(() => {
  const value = map.value;
  const ctx = flowCtx.value;
  if (!value || !ctx) return null;
  const tree = codeTree(ctx);
  if (!tree.some((node) => node.parent)) return null;
  const params = depthParams(new Set(tree.map((node) => node.id)));
  if (!params) return null;
  const result = foldFlows(value.dataflow.flows as FlowItem[], ctx, {
    codeLevel: params.level, sourceLevel: params.level, openCode: params.open
  });
  const groupTitles = new Map(ctx.grouping.groups.map((group) => [group.id, group.title ?? group.id]));
  const sourceTitles = new Map(value.dataflow.sources.map((source) => [source.id, source.title ?? source.id]));
  const nodes = new Map<string, FoldNode>();
  const touch = (key: string, title: string, expandable: boolean, flows: number) => {
    const node = nodes.get(key) ?? { key, title, size: 0, expandable };
    node.size += flows;
    nodes.set(key, node);
  };
  for (const link of result.links) {
    touch(`c:${link.from}`, groupTitles.get(link.from) ?? link.from, groupTitles.has(link.from), link.count);
    touch(`s:${link.to}`, sourceTitles.get(link.to) ?? link.to, false, link.count);
  }
  const codeInside = underFn(params.open, tree);
  return foldedDiagram(
    [...nodes.values()],
    result.links.map((link) => ({
      from: `c:${link.from}`,
      to: `s:${link.to}`,
      count: link.count,
      label: link.direction,
      evidence: link.flows[0]?.evidence ?? NO_EVIDENCE,
      status: link.status
    })),
    'потоков',
    // Источники — не ветка дерева кода: призраками становятся только группы кода вне раскрытой.
    { focus: foldFocus.value, inside: (key) => key.startsWith('s:') || codeInside(key.slice(2)) }
  );
});

const functionalDepth = computed<DepthOutput | null>(() => {
  const { capabilities: all, relations: allRelations } = functionalEffective.value;
  if (!all.some((item) => item.parent)) return null;
  const params = depthParams(new Set(all.map((item) => item.id)));
  if (!params) return null;
  // Состояние и «ждёт» считаются по всему дереву, а не по тому, что осталось под фильтром.
  const views = capabilityViews(all, allRelations, coverage.value);
  const plan = planPredicate(all, { priority: planPriority.value, horizon: planHorizon.value });
  const filter = statusFilter.value;
  const keepLeaf = filter || plan || onlyRisks.value
    ? (leaf: (typeof all)[number]) => {
      if (filter && !(filter === 'unrated' ? !isImplStatus(leaf.status) : leaf.status === filter)) return false;
      if (plan && !plan(leaf)) return false;
      if (onlyRisks.value && (views.get(leaf.id)?.flags.length ?? 0) === 0) return false;
      return true;
    }
    : null;
  const kept = filterLeaves(all, keepLeaf);
  if (kept.length === 0) return { text: '', details: {}, paths: {}, nodes: {}, edges: [], neighbors: {} };
  const hidden = new Set(hiddenKinds.value);
  const relations = allRelations.filter((relation) => !hidden.has(relation.type));
  const open = params.open && kept.some((item) => item.id === params.open) ? params.open : null;
  const overview = overviewAt(kept, relations, open, params.level);
  const treeNodes = kept.map((item) => ({ id: item.id, parent: item.parent }));
  const visible = (id: string) => visibleAt(id, treeNodes, open, params.level);
  const titleOf = new Map(all.map((item) => [item.id, item.title ?? item.id]));
  const byId = new Map(all.map((item) => [item.id, item]));
  // Признаки риска есть только у нижних возможностей: узел-группа берёт их у всех, кто под ним.
  const flagsUnder = new Map<string, Set<string>>();
  for (const item of kept) {
    const set = flagsUnder.get(visible(item.id)) ?? new Set<string>();
    for (const flag of views.get(item.id)?.flags ?? []) set.add(flag);
    flagsUnder.set(visible(item.id), set);
  }
  const mode = capMode.value;
  const place = (id: string): { cls: string; text: string } => {
    const view = views.get(id);
    const status = view?.status ?? 'unrated';
    if (mode === 'coverage') {
      const level = view?.coverage?.level ?? 'none';
      return { cls: `cv_${level}`, text: COVERAGE_LABEL[level] };
    }
    if (mode === 'risks') {
      const flags = flagsUnder.get(id) ?? new Set<string>();
      const key = flags.has('cycle') ? 'red' : flags.size === 0 ? 'none' : [...flags].some((flag) => flag !== 'waits') ? 'orange' : 'yellow';
      return { cls: `rk_${key}`, text: FOLD_RISK[key] ?? key };
    }
    if (mode === 'order') {
      const key = view?.priority?.value === 'wont' ? 'skip'
        : status === 'implemented' ? 'done'
          : view && view.waiting.length > 0 ? 'wait'
            : status === 'unrated' ? 'unrated' : 'start';
      return { cls: `or_${key}`, text: FOLD_ORDER[key] ?? key };
    }
    return { cls: `st_${status}`, text: IMPL_LABEL[status] };
  };
  const nodes: FoldNode[] = overview.nodes.map((node) => {
    const item = byId.get(node.id);
    const view = views.get(node.id);
    const { cls, text } = place(node.id);
    const score = node.expandable && node.progress.total > 0 ? `${node.progress.implemented} из ${node.progress.total}` : '';
    return {
      key: node.id, title: node.title, size: node.size, expandable: node.expandable, summary: item?.summary, cls,
      lines: [score, text].filter(Boolean),
      extra: {
        capability: true,
        ...(item?.note ? { note: item.note } : {}),
        ...(view ? { capabilityView: view } : {})
      }
    };
  });
  const edges: FoldEdge[] = overview.edges.map((edge) => ({
    from: edge.from,
    to: edge.to,
    count: edge.count,
    label: FOLD_KIND[edge.type] ?? edge.type,
    evidence: NO_EVIDENCE,
    arrow: FOLD_ARROW[edge.type] ?? '-->',
    // Клик по стрелке — исходные связи с видами и описанием, а не пустое свидетельство.
    link: {
      fromGroup: edge.from,
      toGroup: edge.to,
      fromTitle: titleOf.get(edge.from) ?? edge.from,
      toTitle: titleOf.get(edge.to) ?? edge.to,
      status: 'pending',
      cycle: edge.type === 'depends' && overview.cycle.has(edge.from) && overview.cycle.has(edge.to),
      imports: edge.members.map((member) => ({
        from: titleOf.get(member.from) ?? member.from,
        to: titleOf.get(member.to) ?? member.to,
        evidence: { path: '', line: 0, fragment: `${FOLD_KIND[member.type] ?? member.type}${member.summary ? `: ${member.summary}` : ''}` }
      }))
    }
  }));
  return foldedDiagram(nodes, edges, 'возможностей', { focus: foldFocus.value, inside: underFn(open, treeNodes) });
});

/** Данные для подсказок дробления открытой группы кодовой карты (`MapSplitHints`, T-0097). */
const splitHints = computed(() => {
  const value = map.value;
  if (!value || !openGroupId.value) return null;
  const base = filteredCodemap.value ?? value.codemap;
  const tree = groupTree(base.modules, base.imports, value.codemap.groups);
  const groupIds = new Set(tree.nodes.map((node) => node.id));
  const modules = new Set(base.modules.map((item) => item.id));
  for (const edge of base.imports) { modules.add(edge.from); modules.add(edge.to); }
  const nodes: TreeNode[] = [
    ...tree.nodes.map((node) => ({ id: node.id, parent: node.parent })),
    ...[...modules].filter((id) => !groupIds.has(id)).map((id) => ({ id, parent: tree.groupOf(id) }))
  ];
  const edges: HierarchyEdge[] = base.imports.map((edge) => ({ from: edge.from, to: edge.to, kind: 'import' }));
  return { nodes, edges };
});
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

      <!-- Вектор — над списками карт и описью: это якорь всего проекта, а не подробность одной вкладки. -->
      <VisionCard
        v-if="map"
        :project-id="projectId"
        :vision="map.functional.vision"
        @changed="() => refresh()"
      />

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

      <MapInventory :project-id="projectId" @changed="() => refresh()" />

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
                  <div v-if="hasGroupSwitch" class="ml-auto flex gap-1">
                    <UButton
                      size="xs"
                      :variant="allShown ? 'outline' : 'solid'"
                      color="neutral"
                      icon="i-lucide-boxes"
                      @click="current.key === 'dataflow' ? showFlowGroups() : showGroups()"
                    >
                      Группы
                    </UButton>
                    <UButton
                      size="xs"
                      :variant="allShown ? 'solid' : 'outline'"
                      color="neutral"
                      icon="i-lucide-network"
                      @click="current.key === 'dataflow' ? showAllFlows() : showAllModules()"
                    >
                      {{ current.key === 'dataflow' ? 'Все потоки' : 'Все модули' }}
                    </UButton>
                  </div>
                  <UTabs
                    v-model="viewMode"
                    :class="hasGroupSwitch ? 'w-40' : 'ml-auto w-40'"
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

            <template v-if="shown === 'dataflow' && flowMode === 'groups'">
              <p class="mb-3 text-sm text-muted">
                Кто читает и пишет где: группы кода слева, виды источников справа; стрелка идёт по направлению
                данных, подпись — число потоков. Клик — карточка, двойной клик — открыть.
              </p>
            </template>

            <template v-if="shown === 'dataflow' && (flowMode === 'code' || flowMode === 'kind')">
              <div class="mb-3 space-y-1 text-sm">
                <p class="flex flex-wrap items-center gap-1">
                  <UButton size="xs" variant="link" color="neutral" icon="i-lucide-chevron-left" @click="showFlowGroups">
                    Все группы
                  </UButton>
                  <span class="text-muted">›</span>
                  <span class="font-medium">{{ flowMode === 'code' ? flowGroupTitle : flowKindLabel }}</span>
                  <span class="text-muted">
                    · {{ flowMode === 'code' ? 'группа кода' : 'вид источников' }},
                    {{ plural(flowScopeValue?.sources.length ?? 0, 'источник', 'источника', 'источников') }}
                  </span>
                </p>
                <p v-if="flowMode === 'code'" class="text-xs text-muted">
                  Выберите модуль или источник — другие группы, которые трогают те же источники, появятся призраками.
                </p>
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
                <MapSplitHints
                  v-if="splitHints"
                  :group-id="openGroupId"
                  :nodes="splitHints.nodes"
                  :edges="splitHints.edges"
                />
              </div>
            </template>

            <!-- Аудит архитектуры — мнение модели о том, чего граф импортов не видит; ничего не пишет (docs/07-maps.md). -->
            <PromptPanel
              v-if="shown === 'codemap' && map.codemap.modules.length > 0 && architecture?.enabled"
              class="mb-3"
              :project-id="projectId"
              kind="architecture"
              label="Аудит архитектуры"
              hint="Ответ — таблица замечаний: ничего не пишется, в задачи их превращаете вы"
            >
              <template #answer="{ answer }">
                <ArchitectureAudit :project-id="projectId" :answer="answer" />
              </template>
            </PromptPanel>

            <!-- Модель предлагает границы, человек их утверждает (docs/07-maps.md, «Группы: уровень над модулями»). -->
            <PromptPanel
              v-if="shown === 'codemap' && map.codemap.modules.length > 0"
              class="mb-3"
              :project-id="projectId"
              kind="groups"
              label="Сгруппировать модули"
              hint="Ответ сохраняется черновиком карты и требует подтверждения"
              @answered="onAnswer"
            >
              <template #answer="{ answer }">
                <div class="mb-3 flex flex-wrap items-center gap-3">
                  <UButton size="sm" :loading="saving" @click="saveDraft(answer, 'Группы модулей')">Сохранить черновиком</UButton>
                  <NuxtLink
                    v-if="draftId"
                    :to="`/projects/${projectId}/records/${draftId}`"
                    class="text-sm hover:underline"
                  >Черновик {{ draftId }} создан — подтвердите его, и группы вступят в силу</NuxtLink>
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

              <PromptPanel
                class="mb-3"
                :project-id="projectId"
                kind="relations"
                label="Предложить связи"
                hint="Модель читает дерево и код и предлагает связи — это её мнение, подтверждает человек"
                :disabled="map.functional.capabilities.length < 2"
                disabled-reason="Связывать нечего: в карте меньше двух возможностей."
              >
                <template #answer="{ answer }">
                  <FunctionalRelations
                    :project-id="projectId"
                    :answer="answer"
                    :titles="capabilityTitles"
                    @apply="applyRelations"
                  />
                </template>
              </PromptPanel>

              <MapDepthBar kind="functional" :capabilities="functionalEffective.capabilities" /><CourseHistory :project-id="projectId" :history="map.functional.history" />

              <FunctionalSummary
                v-if="functionalProgress.total > 0"
                v-model:filter="statusFilter"
                :progress="functionalProgress"
              />

              <FunctionalNext
                :capabilities="functionalEffective.capabilities"
                :relations="functionalEffective.relations"
                @select="selectCapability"
                @show-unrated="statusFilter = 'unrated'"
              />

              <!-- Всегда на месте: в режиме «Граф» прячется само дерево, а полосы сохранения остаются. -->
              <FunctionalTree
                v-model:marks="marks"
                :tree-hidden="functionalView !== 'tree'"
                v-model:relation-marks="relationMarks"
                :project-id="projectId"
                :capabilities="functionalEffective.capabilities"
                :saved="map.functional.capabilities"
                :relations="functionalEffective.relations"
                :saved-relations="map.functional.relations"
                :coverage="coverage"
                :filter="statusFilter"
                @select="(value) => (selection = value)"
                @changed="() => refresh()"
              />
              <template v-if="functionalView === 'graph'">
                <FunctionalGraphBar
                  v-if="map.functional.capabilities.length"
                  v-model:mode="capModeModel"
                  v-model:hidden-kinds="hiddenKinds"
                  v-model:priority="planPriority"
                  v-model:horizon="planHorizon"
                  v-model:only-risks="onlyRisks"
                  :level="capLevel"
                  :can-switch="functionalGroups.groups.length >= 2"
                  :group-title="capGroupTitle"
                  :has-coverage="!!coverage"
                  :kind-counts="kindCounts"
                  @show-groups="showCapGroups"
                  @show-all="showCapAll"
                />
                <FunctionalLegendBar v-if="current.legend" :legend="current.legend" />
                <p v-if="!current.text" class="text-sm text-muted">
                  {{ map.functional.capabilities.length ? 'Под эти фильтры ничего не подошло.' : 'В подтверждённых картах эта структура не описана.' }}
                </p>
                <template v-else>
                  <!-- Легенда — полоса над схемой (FunctionalLegendBar), вне холста. -->
                  <MermaidDiagram
                    :key="`${capLevel}:${capGroupId}`"
                    :source="current.text"
                    :details="current.details"
                    :paths="current.paths"
                    :edges="current.edges"
                    :neighbors="current.neighbors"
                    :pending-ids="pendingNodeIds"
                    :ghost-ids="ghostNodeIds"
                    :focus-key="capFocus && capLevel !== 'groups' ? fromNodeId(capFocus) : null"
                    :keep-view="true"
                    :fullscreen-target="stage"
                    :id="`map-${current.key}`"
                    @node-click="onNodeClick"
                    @node-dblclick="onNodeDblClick"
                    @background-click="onBackgroundClick"
                    @edge-click="onEdgeClick"
                  />
                </template>
              </template>
            </template>

            <template v-else>
              <!-- Легенда — полоса над схемой, вне холста (docs/04-ui.md, «Легенда кодовой базы, потоков и путей»). -->
              <MapDepthBar v-if="shown !== 'userflow'" :kind="shown === 'dataflow' ? 'dataflow' : 'codemap'" :modules="map.codemap.modules" :imports="map.codemap.imports" :groups="map.codemap.groups" /><ArchitectureNote v-if="shown === 'codemap'":project-id="projectId" :report="architecture" />
              <MapLegendBar v-if="current.mapLegend" :items="current.mapLegend" />
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
                :key="shown === 'codemap' ? scopeKey : shown === 'dataflow' ? flowScopeKey : shown"
                :source="current.text"
                :details="current.details"
                :paths="current.paths"
                :edges="current.edges"
                :neighbors="current.neighbors"
                :pending-ids="pendingNodeIds"
                :ghost-ids="ghostNodeIds"
                :focus-key="shown === 'codemap' && ghostFor ? moduleNodeId(ghostFor) : shown === 'dataflow' ? flowFocusKey : null"
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
            :capability-titles="capabilityTitles"
            :impact-on="impactOn"
            :to="staged ? stage : null"
            @impact="impactOn = !impactOn"
            @unrelate="removeRelation"
            @close="onBackgroundClick"
            @open-group="openGroupFromCard"
            @open-flow="enterFlow"
          />
        </div>
      </template>
    </template>
  </div>
</template>
