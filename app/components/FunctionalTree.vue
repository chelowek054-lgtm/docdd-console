<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { Capability } from './FunctionalTreeNode.vue';
import type { MapSelection } from '~/utils/map-mermaid';

/**
 * Функциональная карта — дерево, а не диаграмма: читает её часто не
 * разработчик, а доменный специалист (docs/07-maps.md, «Экран: дерево, а не
 * mindmap»). У вида нет свидетельства, поэтому правка обходится без похода к
 * модели — форма пишет напрямую через `POST /map/capability`, каждое
 * действие черновиком, который тут же можно подтвердить одной кнопкой.
 */

const props = defineProps<{
  projectId: string;
  capabilities: Capability[];
}>();

const emit = defineEmits<{
  select: [selection: MapSelection];
  changed: [];
}>();

function childrenOf(id: string): Capability[] {
  return props.capabilities.filter((item) => item.parent === id);
}

function depthOf(item: Capability, seen: ReadonlySet<string> = new Set()): number {
  if (!item.parent || seen.has(item.id)) return 0;
  const parent = props.capabilities.find((candidate) => candidate.id === item.parent);
  if (!parent) return 0;
  return 1 + depthOf(parent, new Set([...seen, item.id]));
}

// Возможность без родителя, найденного в этом же списке, — тоже корень:
// у осиротевшей ветки (родителя убрали) дерево не должно молча теряться.
const roots = computed(() => props.capabilities.filter(
  (item) => !item.parent || !props.capabilities.some((candidate) => candidate.id === item.parent)
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

function toggle(id: string) {
  const next = new Set(expanded.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  expanded.value = next;
}

function onSelect(item: Capability) {
  emit('select', {
    kind: 'node', id: item.id, title: item.title, summary: item.summary,
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
  const summary = formSummary.value.trim() || undefined;
  if (editingId.value) {
    const current = props.capabilities.find((item) => item.id === editingId.value);
    if (!current) return;
    // Повторное объявление — уточнение, побеждает последнее: поля, которых здесь
    // нет, из возможности пропали бы, поэтому parent и summary едут вместе.
    void saveCapability({ id: current.id, title, parent: current.parent, summary }, `изменена «${title}»`);
  } else {
    const id = slugify(title);
    void saveCapability(
      { id, title, parent: formParent.value ?? undefined, summary },
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
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <UButton size="xs" icon="i-lucide-plus" variant="soft" @click="openAdd(null)">
        Добавить возможность
      </UButton>

      <p v-if="pendingDraft" class="flex flex-wrap items-center gap-2 text-sm text-muted">
        Черновик {{ pendingDraft.id }} создан: {{ pendingDraft.label }}.
        <UButton size="xs" :loading="confirming" @click="confirmDraft">Подтвердить</UButton>
      </p>
    </div>

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

    <p v-if="roots.length === 0" class="rounded border border-dashed border-default p-6 text-center text-sm text-muted">
      Возможностей пока нет — добавьте первую.
    </p>
    <ul v-else class="space-y-0.5">
      <FunctionalTreeNode
        v-for="item in roots"
        :key="item.id"
        :item="item"
        :children="childrenOf(item.id)"
        :all-capabilities="capabilities"
        :expanded="expanded"
        @toggle="toggle"
        @select="onSelect"
        @add-child="(id) => openAdd(id)"
        @edit="openEdit"
        @remove="removeCapability"
      />
    </ul>
  </div>
</template>
