<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { Capability } from './FunctionalTreeNode.vue';
import type { MapSelection } from '~/utils/map-mermaid';
import { capabilityViews } from '~/utils/functional-view';
import {
  HORIZONS,
  HORIZON_LABEL,
  IMPL_LABEL,
  NO_RELATION_MARKS,
  PRIORITIES,
  PRIORITY_LABEL,
  RELATION_LABEL,
  RELATION_TYPES,
  filterByStatus,
  isTreeLink,
  queueRelationAdd,
  relationMarkCount,
  type CapabilityCoverage,
  type Horizon,
  type ImplStatus,
  type Mark,
  type Priority,
  type RelationLike,
  type RelationMarks,
  type RelationType,
  type StatusFilter
} from '../../server/lib/functional';
const { t } = useT();

/**
 * Функциональная карта — дерево, а не диаграмма: читает её часто не
 * разработчик, а доменный специалист (docs/07-maps.md, «Экран: дерево, граф
 * состояния»). У вида нет свидетельства, поэтому правка обходится без похода к
 * модели — форма пишет напрямую через `POST /map/capability`, каждое
 * действие черновиком, который тут же можно подтвердить одной кнопкой.
 * Отметки состояния и связи — иначе, пачкой: клик откладывает отметку (или
 * связь) на экране, а «Сохранить отметки» / «Сохранить связи» заводит одну
 * запись на все (docs/04-ui.md, «Связи — тоже пачкой»).
 */

const props = defineProps<{
  projectId: string;
  /** С уже наложенными несохранёнными отметками (`withMarks`). */
  capabilities: Capability[];
  /** Те же возможности без отметок — то, что сейчас записано в карте. */
  saved: Capability[];
  /** С уже наложенными несохранёнными связями (`withRelationMarks`). */
  relations: RelationLike[];
  /** Связи, как они записаны в карте сейчас: по ним решаем, что уже стоит. */
  savedRelations: RelationLike[];
  /** Что стоит за возможностями в процессе; нет, пока не загружено. */
  coverage?: Record<string, CapabilityCoverage> | undefined;
  filter: StatusFilter | null;
  /**
   * Режим «Граф»: само дерево прячется, а полосы «Сохранить отметки» и «Сохранить
   * связи» остаются — несохранённое видно и на схеме, и сохранить его надо
   * оттуда же, где его видно (docs/04-ui.md, «Отметки состояния — пачкой»).
   */
  treeHidden?: boolean;
  /**
   * Куда писать правки; по умолчанию — стратегическая карта. Рабочая карта
   * (ADR-0028, п. 3) рисуется этим же деревом и пишет в свой маршрут.
   */
  endpoint?: string;
  /** Свои виды связей рабочей карты; стиль переводит вид в один из пяти для «ждёт» и циклов. */
  relationKinds?: readonly { id: string; label: string; style: RelationType }[];
  /** id нового узла из названия; у рабочей карты id — только латиница (custommap.schema.json). */
  idOf?: (title: string) => string;
}>();

/** Несохранённые отметки живут у родителя: их же кладёт «Проверить по коду» и рисует граф. */
const marks = defineModel<Record<string, Mark>>('marks', { required: true });
/** Несохранённые связи — там же, у родителя: их видят и граф, и карточка. */
const relationMarks = defineModel<RelationMarks>('relationMarks', { required: true });

const emit = defineEmits<{
  select: [selection: MapSelection];
  changed: [];
}>();

const styleOf = computed(() => new Map((props.relationKinds ?? []).map((kind) => [kind.id, kind.style])));
const views = computed(() => capabilityViews(
  props.capabilities,
  props.relationKinds ? props.relations.map((item) => ({ ...item, type: styleOf.value.get(item.type) ?? item.type })) : props.relations,
  props.coverage
));
const visible = computed(() => filterByStatus(props.capabilities, props.filter) as Capability[]);

function childrenOf(id: string): Capability[] {
  return visible.value.filter((item) => item.parent === id);
}

function depthOf(item: Capability, seen: ReadonlySet<string> = new Set()): number {
  if (!item.parent || seen.has(item.id)) return 0;
  const parent = props.capabilities.find((candidate) => candidate.id === item.parent);
  if (!parent) return 0;
  return 1 + depthOf(parent, new Set([...seen, item.id]));
}

// Возможность без родителя, найденного в этом же списке, — тоже корень:
// у осиротевшей ветки (родителя убрали) дерево не должно молча теряться.
const roots = computed(() => visible.value.filter(
  (item) => !item.parent || !visible.value.some((candidate) => candidate.id === item.parent)
));

/** Раскрыто по умолчанию — первые два уровня; глубже читатель разворачивает сам. */
const expanded = ref<Set<string>>(new Set()); const deepOpen = ref(false); onMounted(() => { deepOpen.value = true; }); // в HTML — только первый уровень, второй раскрывается после показа
// Смотрим на состав, а не на сам список: отметка состояния пересобирает массив,
// и раскрытые ветки не должны схлопываться от каждого клика.
watch(() => props.capabilities.map((item) => `${item.id}>${item.parent ?? ''}`).join('|') + deepOpen.value, () => {
  const next = new Set<string>();
  for (const item of props.capabilities) {
    if (depthOf(item) < (deepOpen.value ? 2 : 1)) next.add(item.id);
  }
  expanded.value = next;
}, { immediate: true });

// Под фильтром открыто всё, что осталось: смысл фильтра — увидеть найденное, а не искать его по веткам.
const shownExpanded = computed<ReadonlySet<string>>(() => (
  props.filter ? new Set(visible.value.map((item) => item.id)) : expanded.value
));

function toggle(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

/** Бейдж «ещё не устоялось» на каждой строке перестаёт что-либо отличать, когда стоит у всех. */
const allPending = computed(() => props.capabilities.length > 0 && props.capabilities.every((item) => item.pending));

function onSelect(item: Capability) {
  const view = views.value.get(item.id);
  emit('select', {
    kind: 'node', id: item.id, title: item.title, summary: item.summary, note: item.note,
    declaredBy: item.declaredBy, declaredAt: item.declaredAt, declaredByRole: item.declaredByRole,
    pending: item.pending, capability: true,
    ...(view ? { capabilityView: view } : {})
  });
}

// --- отметки пачкой ---
function mark(id: string, status: ImplStatus | null) {
  const next = { ...marks.value };
  const note = marks.value[id]?.note;
  // Вернули ровно то, что уже в карте, — это не отметка, а её отмена.
  if ((props.saved.find((item) => item.id === id)?.status ?? null) === status && note === undefined) {
    delete next[id];
  } else {
    next[id] = { status, ...(note !== undefined ? { note } : {}) };
  }
  marks.value = next;
}

const markCount = computed(() => Object.keys(marks.value).length);

// --- форма: добавить (себе или подпункт) / переименовать ---
const formParent = ref<string | null>(null);
const formOpen = ref(false);
const editingId = ref<string | null>(null);
const formTitle = ref('');
const formSummary = ref('');
const formStatus = ref<ImplStatus | 'unrated'>('unrated');
const formNote = ref('');
const formPriority = ref<Priority | 'none'>('none');
const formHorizon = ref<Horizon | 'none'>('none');
const saving = ref(false);
const failure = ref<ApiFailure | null>(null);

const statusItems = (['unrated', 'implemented', 'partial', 'not_implemented'] as const)
  .map((value) => ({ label: IMPL_LABEL[value], value }));
const priorityItems = [
  { get label() { return t('t83.m2.NoPriority'); }, value: 'none' as const },
  ...PRIORITIES.map((value) => ({ label: PRIORITY_LABEL[value], value }))
];
const horizonItems = [
  { get label() { return t('t83.m2.NoHorizon'); }, value: 'none' as const },
  ...HORIZONS.map((value) => ({ label: HORIZON_LABEL[value], value }))
];

function resetForm() {
  formTitle.value = '';
  formSummary.value = '';
  formStatus.value = 'unrated';
  formNote.value = '';
  formPriority.value = 'none';
  formHorizon.value = 'none';
}

function openAdd(parentId: string | null) {
  formOpen.value = true;
  relateFrom.value = null;
  formParent.value = parentId;
  editingId.value = null;
  resetForm();
  failure.value = null;
}
function openEdit(item: Capability) {
  formOpen.value = true;
  relateFrom.value = null;
  formParent.value = item.parent ?? null;
  editingId.value = item.id;
  formTitle.value = item.title ?? '';
  formSummary.value = item.summary ?? '';
  formStatus.value = item.status ?? 'unrated';
  formNote.value = item.note ?? '';
  // Свои значения, а не унаследованные: унаследованное правится у родителя.
  formPriority.value = item.priority ?? 'none';
  formHorizon.value = item.horizon ?? 'none';
  failure.value = null;
}
function closeForm() {
  formOpen.value = false;
  editingId.value = null;
  resetForm();
}

const editingIsParent = computed(() => !!editingId.value && childrenOf(editingId.value).length > 0);

/** id из названия — доменный специалист не должен придумывать идентификатор сам. */
function slugify(text: string): string {
  const base = text.trim().toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return base || `vozmozhnost-${Date.now()}`;
}

const pendingDraft = ref<{ id: string; label: string } | null>(null);
const confirming = ref(false);

/** Один ход к серверу: черновик новой записи карты. Отдельное тело на действие — общий разбор ответа. */
async function post(body: Record<string, unknown>, label: string): Promise<boolean> {
  saving.value = true;
  failure.value = null;
  try {
    const response = await $fetch(props.endpoint ?? `/api/projects/${props.projectId}/map/capability`, {
      method: 'POST',
      body,
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return false;
    }
    const record = (response as { record?: { id: string } }).record;
    if (record) pendingDraft.value = { id: record.id, label };
    return true;
  } finally {
    saving.value = false;
  }
}

async function saveCapability(capability: Capability, label: string) {
  if (await post({ action: 'add', capability }, label)) closeForm();
}

function onSubmit() {
  if (!formTitle.value.trim()) return;
  const title = formTitle.value.trim();
  const summary = formSummary.value.trim() || undefined;
  if (editingId.value) {
    const current = props.capabilities.find((item) => item.id === editingId.value);
    if (!current) return;
    // Повторное объявление — уточнение, побеждает последнее: поля, которых здесь
    // нет, из возможности пропали бы, поэтому parent, summary и состояние едут вместе.
    const own = editingIsParent.value ? current.status : (formStatus.value === 'unrated' ? undefined : formStatus.value);
    const note = editingIsParent.value ? current.note : (formNote.value.trim() || undefined);
    // Приоритет и горизонт едут вместе с остальным: иначе повторное объявление их потеряло бы.
    void saveCapability(
      {
        id: current.id, title, parent: current.parent, summary,
        ...(own ? { status: own } : {}), ...(own && note ? { note } : {}),
        ...(formPriority.value !== 'none' ? { priority: formPriority.value } : {}),
        ...(formHorizon.value !== 'none' ? { horizon: formHorizon.value } : {})
      },
      t('t83.m2.ft.changed', { title })
    );
  } else {
    const id = props.idOf ? props.idOf(title) : slugify(title);
    void saveCapability(
      { id, title, parent: formParent.value ?? undefined, summary },
      t('t83.m2.ft.added', { title })
    );
  }
}

async function removeCapability(item: Capability) {
  const kids = childrenOf(item.id);
  const question = kids.length > 0
    ? t('t83.m2.ft.confirmKids', { title: item.title ?? item.id, n: kids.length })
    : t('t83.m2.ft.confirm', { title: item.title ?? item.id });
  // eslint-disable-next-line no-alert -- то же подтверждение, что и на удаление где угодно в браузере; своё модальное окно ради одной кнопки не оправдано.
  if (!confirm(question)) return;
  await post({ action: 'remove', capability: { id: item.id } }, t('t83.m2.ft.removed', { title: item.title ?? item.id }));
}

async function saveMarks() {
  const statuses = Object.entries(marks.value).map(([id, value]) => ({
    id,
    status: value.status,
    ...(value.note !== undefined ? { note: value.note } : {})
  }));
  if (statuses.length === 0) return;
  if (await post({ action: 'status', statuses }, t('t83.m2.ft.marks', { n: statuses.length }))) marks.value = {};
}

// --- форма: связать ---
const relateFrom = ref<Capability | null>(null);
const relateTo = ref('');
const relateType = ref<RelationType>('depends');
const relateSummary = ref('');

function openRelate(item: Capability) {
  formOpen.value = false;
  relateFrom.value = item;
  relateTo.value = '';
  relateType.value = (relationItems.value[0]?.value ?? 'depends') as RelationType;
  relateSummary.value = '';
  failure.value = null;
}

/** С предком и потомком связь не нужна — дерево уже сказало, что они вместе. */
const relateTargets = computed(() => {
  const from = relateFrom.value;
  if (!from) return [];
  return props.capabilities
    .filter((item) => item.id !== from.id && !isTreeLink(from.id, item.id, props.capabilities))
    .map((item) => ({ label: item.title ?? item.id, value: item.id }));
});

/** Связь откладывается в пачку на экране, а не заводит черновик: десять связей — одна запись. */
function submitRelate() {
  const from = relateFrom.value;
  if (!from || !relateTo.value) return;
  const summary = relateSummary.value.trim() || undefined;
  relationMarks.value = queueRelationAdd(
    relationMarks.value,
    { from: from.id, to: relateTo.value, type: relateType.value, ...(summary ? { summary } : {}) },
    props.savedRelations
  );
  relateFrom.value = null;
}

const relationCount = computed(() => relationMarkCount(relationMarks.value));

async function saveRelations() {
  const { add, remove } = relationMarks.value;
  if (add.length + remove.length === 0) return;
  const ok = await post({
    action: 'relations',
    ...(add.length ? { add: add.map(({ from, to, type, summary }) => ({ from, to, type, ...(summary ? { summary } : {}) })) } : {}),
    ...(remove.length ? { remove } : {})
  }, t('t83.m2.ft.links', { add: add.length, remove: remove.length }));
  if (ok) relationMarks.value = NO_RELATION_MARKS;
}

const relationItems = computed(() => props.relationKinds
  ? props.relationKinds.map((kind) => ({ label: kind.label, value: kind.id }))
  : RELATION_TYPES.map((value) => ({ label: RELATION_LABEL[value], value })));

/**
 * Подтверждение прямо здесь, без похода на экран записи: `draft → review →
 * approved` — те же два перехода, что и везде (docs/adr/0012-status-reopening.md),
 * просто кнопкой рядом с деревом, а не отдельным экраном.
 */
async function confirmDraft() {
  if (!pendingDraft.value) return;
  confirming.value = true;
  failure.value = null;
  try {
    const id = pendingDraft.value.id;
    for (const status of ['review', 'approved']) {
      const response = await $fetch(`/api/projects/${props.projectId}/records/${id}/status`, {
        method: 'POST',
        body: { status },
        ignoreResponseError: true
      });
      const problem = failureOf(response);
      if (problem) {
        failure.value = problem;
        return;
      }
    }
    pendingDraft.value = null;
    emit('changed');
  } finally {
    confirming.value = false;
  }
}

// Одна панель действий на всё дерево: по кнопке на каждую строку давали сотни
// скрытых компонентов. Панель встаёт к строке под курсором или в фокусе.
const wrapRef = ref<HTMLElement | null>(null);
const panel = ref<{ item: Capability; top: number; left: number } | null>(null);

function showPanel(item: Capability, anchor: HTMLElement) {
  const wrap = wrapRef.value;
  if (!wrap) return;
  const base = wrap.getBoundingClientRect();
  const rect = anchor.getBoundingClientRect();
  panel.value = { item, top: rect.top - base.top, left: rect.right - base.left };
}

function hidePanel(event?: FocusEvent) {
  const next = event?.relatedTarget as Node | null | undefined;
  if (next && wrapRef.value?.contains(next)) return;
  panel.value = null;
}

</script>

<template>
  <div>
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <UButton v-show="!treeHidden" size="xs" icon="i-lucide-plus" variant="soft" @click="openAdd(null)">
        {{ t('t83.functional-tree.1') }}
      </UButton>

      <p v-if="pendingDraft" class="flex flex-wrap items-center gap-2 text-sm text-muted">
        {{ t('t83.functional-tree.2', { id: pendingDraft.id, label: pendingDraft.label }) }}
        <UButton size="xs" :loading="confirming" @click="confirmDraft">{{ t('t83.functional-tree.3') }}</UButton>
      </p>
    </div>

    <!-- Отметки и связи откладываются на экране — одна запись на пачку, а не черновик на каждый клик.
         Две пачки, а не одна: у них разный смысл и им нужны разные подтверждения. -->
    <div v-if="markCount > 0 || relationCount > 0" class="sticky top-0 z-10 mb-3 space-y-2">
      <div
        v-if="markCount > 0"
        class="flex flex-wrap items-center gap-3 ds-card ds-card--warn p-2 text-sm"
      >
        <span>{{ t('t83.functional-tree.4', { markCount: markCount }) }}</span>
        <UButton size="xs" :loading="saving" @click="saveMarks">{{ t('t83.functional-tree.5') }}</UButton>
        <UButton size="xs" variant="ghost" color="neutral" @click="marks = {}">{{ t('t83.functional-tree.6') }}</UButton>
      </div>
      <div
        v-if="relationCount > 0"
        class="flex flex-wrap items-center gap-3 ds-card ds-card--warn p-2 text-sm"
      >
        <span>{{ t('t83.functional-tree.7', { length: relationMarks.add.length, length2: relationMarks.remove.length }) }}</span>
        <UButton size="xs" :loading="saving" @click="saveRelations">{{ t('t83.functional-tree.8') }}</UButton>
        <UButton size="xs" variant="ghost" color="neutral" @click="relationMarks = NO_RELATION_MARKS">{{ t('t83.functional-tree.6') }}</UButton>
      </div>
    </div>
    <UAlert
      v-if="failure && (treeHidden || (!formOpen && !relateFrom))"
      class="mb-3"
      color="error"
      variant="subtle"
      :title="failure.message"
      :description="failure.detail"
    />

    <UCard v-if="formOpen" v-show="!treeHidden" class="mb-3">
      <p class="mb-2 text-sm text-muted">
        {{ editingId ? t('t83.m2.ft.editTitle') : t('t83.m2.ft.newTitle') }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <UInput
          v-model="formTitle"
          class="min-w-64 flex-1"
          :placeholder="t('t83.functional-tree.9')"
          @keyup.enter="onSubmit"
        />
        <UButton :loading="saving" :disabled="!formTitle.trim()" @click="onSubmit">{{ t('t83.functional-tree.10') }}</UButton>
        <UButton variant="ghost" color="neutral" @click="closeForm">{{ t('t83.functional-tree.11') }}</UButton>
      </div>
      <UTextarea
        v-model="formSummary"
        class="mt-3 w-full"
        :rows="3"
        autoresize
        :placeholder="t('t83.functional-tree.12')"
      />
      <!-- У родителя состояние производное — поле показывать нечем и незачем. -->
      <div v-if="editingId && !editingIsParent" class="mt-3 flex flex-wrap items-start gap-3">
        <USelect v-model="formStatus" class="w-48" :items="statusItems" />
        <UInput
          v-model="formNote"
          class="min-w-64 flex-1"
          :disabled="formStatus === 'unrated'"
          :placeholder="t('t83.functional-tree.13')"
        />
      </div>
      <!-- Приоритет и горизонт — и у родителя: это решение о ветке целиком, в подпунктах оно наследуется. -->
      <div v-if="editingId" class="mt-3 flex flex-wrap items-start gap-3">
        <USelect v-model="formPriority" class="w-48" :items="priorityItems" />
        <USelect v-model="formHorizon" class="w-48" :items="horizonItems" />
      </div>
      <UAlert
        v-if="failure"
        class="mt-3"
        color="error"
        variant="subtle"
        :title="failure.message"
        :description="failure.detail"
      />
    </UCard>

    <UCard v-if="relateFrom" v-show="!treeHidden" class="mb-3">
      <p class="mb-2 text-sm text-muted">
        {{ t('t83.functional-tree.14', { p: relateFrom.title ?? relateFrom.id }) }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <USelect v-model="relateType" class="w-44" :items="relationItems" />
        <USelect
          v-model="relateTo"
          class="min-w-64 flex-1"
          :items="relateTargets"
          :placeholder="t('t83.functional-tree.15')"
        />
        <UButton :disabled="!relateTo" @click="submitRelate">{{ t('t83.functional-tree.16') }}</UButton>
        <UButton variant="ghost" color="neutral" @click="relateFrom = null">{{ t('t83.functional-tree.11') }}</UButton>
      </div>
      <UInput
        v-model="relateSummary"
        class="mt-3 w-full"
        :placeholder="t('t83.functional-tree.17')"
      />
      <UAlert
        v-if="failure"
        class="mt-3"
        color="error"
        variant="subtle"
        :title="failure.message"
        :description="failure.detail"
      />
    </UCard>

    <p v-if="allPending" v-show="!treeHidden" class="mb-3 text-sm text-muted">
      {{ t('t83.functional-tree.18') }}
    </p>

    <p v-if="roots.length === 0" v-show="!treeHidden" class="ds-card ds-card--dashed p-6 text-center text-sm text-muted">
      {{ capabilities.length === 0 ? t('t83.m2.ft.none') : t('t83.m2.ft.noMatch') }}
    </p>
    <div v-else v-show="!treeHidden" ref="wrapRef" class="relative" @mouseleave="hidePanel()" @focusout="hidePanel">
    <ul class="space-y-0.5">
      <FunctionalTreeNode
        v-for="item in roots"
        :key="item.id"
        :item="item"
        :children="childrenOf(item.id)"
        :all-capabilities="visible"
        :views="views"
        :marks="marks"
        :hide-pending="allPending"
        :expanded="shownExpanded"
        @toggle="toggle"
        @select="onSelect"
        @add-child="(id) => openAdd(id)"
        @edit="openEdit"
        @relate="openRelate"
        @remove="removeCapability"
        @mark="mark"
        @hover="showPanel"
      />
    </ul>
    <div
      v-if="panel"
      class="absolute z-10 flex -translate-x-full gap-1 rounded bg-elevated"
      :style="{ top: panel.top + 'px', left: panel.left + 'px' }"
    >
      <UButton icon="i-lucide-plus" size="xs" variant="ghost" color="neutral" :title="t('t83.functional-tree.19')" @click="openAdd(panel.item.id)" />
      <UButton icon="i-lucide-pencil" size="xs" variant="ghost" color="neutral" :title="t('t83.functional-tree.20')" @click="openEdit(panel.item)" />
      <UButton icon="i-lucide-link" size="xs" variant="ghost" color="neutral" :title="t('t83.functional-tree.21')" @click="openRelate(panel.item)" />
      <UButton icon="i-lucide-trash-2" size="xs" variant="ghost" color="neutral" :title="t('t83.functional-tree.22')" @click="removeCapability(panel.item)" />
    </div>
    </div>
  </div>
</template>
