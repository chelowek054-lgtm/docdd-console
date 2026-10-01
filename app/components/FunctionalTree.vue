<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { Capability } from './FunctionalTreeNode.vue';
import type { MapSelection } from '~/utils/map-mermaid';
import {
  summarize, tallyText, visibleUnder,
  type CapabilityState, type CapabilityStatus, type MarkPatch
} from '~~/server/lib/functional';

/**
 * Функциональная карта — дерево, а не диаграмма: читает её часто не
 * разработчик, а доменный специалист (docs/07-maps.md, «Экран: дерево, а не
 * mindmap»). У вида нет свидетельства, поэтому правка обходится без похода к
 * модели — форма пишет напрямую через `POST /map/capability`, каждое
 * действие черновиком, который тут же можно подтвердить одной кнопкой.
 */

const props = defineProps<{
  projectId: string;
  /** Как в подтверждённой карте — без несохранённых отметок. */
  capabilities: Capability[];
}>();

const emit = defineEmits<{
  select: [selection: MapSelection];
  changed: [];
}>();

// --- состояние реализации: отметки откладываются, пока их не сохранили ---
// Клик по значку не заводит запись: иначе каждый клик создавал бы отдельный
// черновик карты (docs/04-ui.md, «Функциональная карта»).
const marks = ref<Record<string, MarkPatch>>({});
const filter = ref<CapabilityState | null>(null);

/** Возможности с учётом несохранённых отметок: то, что человек видит прямо сейчас. */
const effective = computed<Capability[]>(() => props.capabilities.map((item) => {
  const mark = marks.value[item.id];
  if (!mark) return item;
  const next: Capability = { ...item };
  if (mark.status !== undefined) {
    if (mark.status === null) delete next.status;
    else next.status = mark.status;
  }
  if (mark.note !== undefined) {
    if (mark.note.trim()) next.note = mark.note.trim();
    else delete next.note;
  }
  return next;
}));

const summary = computed(() => summarize(effective.value));
const visible = computed(() => visibleUnder(effective.value, summary.value, filter.value));
const marked = computed(() => new Set(Object.keys(marks.value)));
const markCount = computed(() => marked.value.size);

/**
 * Если пометка «ещё не устоялось» стоит у всех строк, она ничего не отличает —
 * одна строка над деревом вместо бейджа на каждой (docs/04-ui.md).
 */
const allPending = computed(() => props.capabilities.length > 0 && props.capabilities.every((item) => item.pending));

function onMark(id: string, patch: MarkPatch) {
  const saved = props.capabilities.find((item) => item.id === id);
  const merged: MarkPatch = { ...marks.value[id], ...patch };
  // Вернули всё как в карте — отметки больше нет: считать её несохранённой незачем.
  const sameStatus = merged.status === undefined || (merged.status ?? undefined) === saved?.status;
  const sameNote = merged.note === undefined || (merged.note.trim() || undefined) === saved?.note;
  const next = { ...marks.value };
  if (sameStatus && sameNote) delete next[id];
  else next[id] = merged;
  marks.value = next;
}

function discardMarks() {
  marks.value = {};
}

/**
 * Отметки снаружи — из таблицы «Проверить по коду». Ложатся несохранёнными,
 * как если бы человек поставил их сам: черновик карты по ним не заводится
 * (docs/07-maps.md, «“Проверить по коду” — мнение, не свидетельство»).
 */
function addMarks(list: { id: string; status: CapabilityStatus; note?: string }[]) {
  for (const entry of list) {
    onMark(entry.id, entry.note === undefined ? { status: entry.status } : { status: entry.status, note: entry.note });
  }
}
defineExpose({ addMarks });

async function saveMarks() {
  const body = Object.entries(marks.value).map(([id, mark]) => {
    const saved = props.capabilities.find((item) => item.id === id);
    // Отметка только с `note` не должна снимать состояние: сервер читает `null` как «снять».
    const entry: { id: string; status: string | null; note?: string } = {
      id,
      status: mark.status === undefined ? (saved?.status ?? null) : mark.status
    };
    if (mark.note !== undefined) entry.note = mark.note;
    return entry;
  });
  const count = body.length;

  saving.value = true;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/map/capability`, {
      method: 'POST',
      body: { action: 'status', marks: body },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const record = (response as { record?: { id: string } }).record;
    marks.value = {};
    if (record) pendingDraft.value = { id: record.id, label: `отмечено возможностей: ${count}` };
  } finally {
    saving.value = false;
  }
}

function childrenOf(id: string): Capability[] {
  return effective.value.filter((item) => item.parent === id && (!visible.value || visible.value.has(item.id)));
}

function depthOf(item: Capability, seen: ReadonlySet<string> = new Set()): number {
  if (!item.parent || seen.has(item.id)) return 0;
  const parent = props.capabilities.find((candidate) => candidate.id === item.parent);
  if (!parent) return 0;
  return 1 + depthOf(parent, new Set([...seen, item.id]));
}

// Возможность без родителя, найденного в этом же списке, — тоже корень:
// у осиротевшей ветки (родителя убрали) дерево не должно молча теряться.
const roots = computed(() => effective.value.filter(
  (item) => (!item.parent || !effective.value.some((candidate) => candidate.id === item.parent))
    && (!visible.value || visible.value.has(item.id))
));

/** Раскрыто по умолчанию — первые два уровня; глубже читатель разворачивает сам. */
const expanded = ref<Set<string>>(new Set());
watch(() => props.capabilities, (list) => {
  const next = new Set<string>();
  for (const item of list) {
    if (depthOf(item) < 2) next.add(item.id);
  }
  expanded.value = next;
}, { immediate: true });

/** Под фильтром раскрыто всё: найденное не должно прятаться под свёрнутым родителем. */
const shownExpanded = computed(() => (filter.value ? new Set(props.capabilities.map((item) => item.id)) : expanded.value));

function toggle(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

function onSelect(item: Capability) {
  const own = summary.value.byId.get(item.id);
  // У родителя состояние расчётное, а не из файла: карточка показывает то же,
  // что значок в строке, и счёт нижних рядом (docs/07-maps.md).
  const state = own?.state;
  emit('select', {
    kind: 'node', id: item.id, title: item.title, summary: item.summary,
    status: state && state !== 'unassessed' ? state : undefined,
    note: item.note,
    progress: own && !own.leaf ? tallyText(own.tally) : undefined,
    declaredBy: item.declaredBy, pending: item.pending, capability: true
  });
}

// --- форма: добавить (себе или подпункт) / переименовать ---
const formParent = ref<string | null>(null);
const formOpen = ref(false);
const editingId = ref<string | null>(null);
const formTitle = ref('');
const formSummary = ref('');
const saving = ref(false);
const failure = ref<ApiFailure | null>(null);

function openAdd(parentId: string | null) {
  formOpen.value = true;
  formParent.value = parentId;
  editingId.value = null;
  formTitle.value = '';
  formSummary.value = '';
  failure.value = null;
}
function openEdit(item: Capability) {
  formOpen.value = true;
  formParent.value = item.parent ?? null;
  editingId.value = item.id;
  formTitle.value = item.title ?? '';
  formSummary.value = item.summary ?? '';
  failure.value = null;
}
function closeForm() {
  formOpen.value = false;
  editingId.value = null;
  formTitle.value = '';
  formSummary.value = '';
}

/** id из названия — доменный специалист не должен придумывать идентификатор сам. */
function slugify(text: string): string {
  const base = text.trim().toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '');
  return base || `vozmozhnost-${Date.now()}`;
}

const pendingDraft = ref<{ id: string; label: string } | null>(null);
const confirming = ref(false);

async function saveCapability(capability: Capability, label: string) {
  saving.value = true;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/map/capability`, {
      method: 'POST',
      body: { action: 'add', capability },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const record = (response as { record?: { id: string } }).record;
    closeForm();
    if (record) pendingDraft.value = { id: record.id, label };
  } finally {
    saving.value = false;
  }
}

function onSubmit() {
  if (!formTitle.value.trim()) return;
  const title = formTitle.value.trim();
  const summaryText = formSummary.value.trim() || undefined;
  if (editingId.value) {
    const current = props.capabilities.find((item) => item.id === editingId.value);
    if (!current) return;
    // Повторное объявление заменяет элемент целиком: поля, которых здесь нет,
    // из возможности пропали бы, поэтому parent, status и note едут вместе — иначе
    // переименование молча сняло бы отметку состояния (docs/07-maps.md).
    void saveCapability(
      { id: current.id, title, parent: current.parent, summary: summaryText, status: current.status, note: current.note },
      `изменена «${title}»`
    );
  } else {
    const id = slugify(title);
    void saveCapability(
      { id, title, parent: formParent.value ?? undefined, summary: summaryText },
      `добавлена «${title}»`
    );
  }
}

async function removeCapability(item: Capability) {
  const kids = childrenOf(item.id);
  const question = kids.length > 0
    ? `Убрать «${item.title ?? item.id}»? У неё ${kids.length} подпунктов — они останутся, но станут отдельными.`
    : `Убрать «${item.title ?? item.id}»?`;
  // eslint-disable-next-line no-alert -- то же подтверждение, что и на удаление где угодно в браузере; своё модальное окно ради одной кнопки не оправдано.
  if (!confirm(question)) return;

  saving.value = true;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/map/capability`, {
      method: 'POST',
      body: { action: 'remove', capability: { id: item.id } },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const record = (response as { record?: { id: string } }).record;
    if (record) pendingDraft.value = { id: record.id, label: `убрана «${item.title ?? item.id}»` };
  } finally {
    saving.value = false;
  }
}

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
</script>

<template>
  <div>
    <FunctionalSummary :tally="summary.overall" :filter="filter" @filter="(state) => (filter = state)" />

    <p v-if="allPending" class="mb-3 text-sm text-muted">
      Все эти возможности объявлены картой, которая ещё не устоялась.
    </p>

    <div class="mb-3 flex flex-wrap items-center gap-3">
      <UButton size="xs" icon="i-lucide-plus" variant="soft" @click="openAdd(null)">
        Добавить возможность
      </UButton>

      <!-- Пачка отметок: один черновик на все, а не по записи на клик. -->
      <p v-if="markCount > 0" class="flex flex-wrap items-center gap-2 text-sm">
        <span class="text-muted">Несохранённых отметок: {{ markCount }}</span>
        <UButton size="xs" :loading="saving" @click="saveMarks">Сохранить отметки</UButton>
        <UButton size="xs" variant="ghost" color="neutral" @click="discardMarks">Сбросить</UButton>
      </p>

      <p v-if="pendingDraft" class="flex flex-wrap items-center gap-2 text-sm text-muted">
        Черновик {{ pendingDraft.id }} создан: {{ pendingDraft.label }}.
        <UButton size="xs" :loading="confirming" @click="confirmDraft">Подтвердить</UButton>
      </p>
    </div>

    <UAlert
      v-if="failure && !formOpen"
      class="mb-3"
      color="error"
      variant="subtle"
      :title="failure.message"
      :description="failure.detail"
    />

    <UCard v-if="formOpen" class="mb-3">
      <p class="mb-2 text-sm text-muted">
        {{ editingId ? 'Название и описание' : 'Название возможности' }}
      </p>
      <div class="flex flex-wrap items-center gap-3">
        <UInput
          v-model="formTitle"
          class="min-w-64 flex-1"
          placeholder="Как это назовёт доменный специалист, не разработчик"
          @keyup.enter="onSubmit"
        />
        <UButton :loading="saving" :disabled="!formTitle.trim()" @click="onSubmit">Сохранить</UButton>
        <UButton variant="ghost" color="neutral" @click="closeForm">Отмена</UButton>
      </div>
      <UTextarea
        v-model="formSummary"
        class="mt-3 w-full"
        :rows="3"
        autoresize
        placeholder="Описание — необязательно: зачем это в системе и что даёт пользователю, простыми словами"
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

    <p v-if="effective.length === 0" class="rounded border border-dashed border-default p-6 text-center text-sm text-muted">
      Возможностей пока нет — добавьте первую.
    </p>
    <p v-else-if="roots.length === 0" class="rounded border border-dashed border-default p-6 text-center text-sm text-muted">
      Под этот фильтр не попала ни одна возможность.
    </p>
    <ul v-else class="space-y-0.5">
      <FunctionalTreeNode
        v-for="item in roots"
        :key="item.id"
        :item="item"
        :children="childrenOf(item.id)"
        :all-capabilities="effective"
        :expanded="shownExpanded"
        :summary="summary.byId"
        :visible="visible"
        :marked="marked"
        :quiet="allPending"
        @toggle="toggle"
        @select="onSelect"
        @add-child="(id) => openAdd(id)"
        @edit="openEdit"
        @remove="removeCapability"
        @mark="onMark"
      />
    </ul>
  </div>
</template>
