<script setup lang="ts">
import {
  CAPABILITY_STATUSES, STATE_LABEL, tallyText,
  type CapabilityStatus, type CapabilitySummary, type MarkPatch
} from '~~/server/lib/functional';

export interface Capability {
  id: string;
  title?: string;
  parent?: string;
  summary?: string;
  status?: CapabilityStatus;
  note?: string;
  declaredBy?: string;
  pending?: boolean;
}

const props = defineProps<{
  item: Capability;
  children: Capability[];
  allCapabilities: Capability[];
  expanded: ReadonlySet<string>;
  summary: ReadonlyMap<string, CapabilitySummary>;
  /** Какие возможности видны при фильтре по состоянию; `null` — все. */
  visible: ReadonlySet<string> | null;
  /** Возможности с несохранённой отметкой. */
  marked: ReadonlySet<string>;
  /** Бейдж «ещё не устоялось» уже сказан одной строкой над деревом. */
  quiet: boolean;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  select: [item: Capability];
  'add-child': [parentId: string];
  edit: [item: Capability];
  remove: [item: Capability];
  mark: [id: string, patch: MarkPatch];
}>();

const isOpen = computed(() => props.expanded.has(props.item.id));
function childrenOf(id: string): Capability[] {
  return props.allCapabilities.filter((item) => item.parent === id && (!props.visible || props.visible.has(item.id)));
}

const own = computed(() => props.summary.get(props.item.id));
const state = computed(() => own.value?.state ?? 'unassessed');
const isLeaf = computed(() => own.value?.leaf ?? true);

const dimmed = computed(() => props.item.pending && !props.quiet);

const menu = computed(() => [[
  ...CAPABILITY_STATUSES.map((status) => ({
    label: STATE_LABEL[status],
    icon: STATE_UI[status].icon,
    onSelect: () => emit('mark', props.item.id, { status })
  })),
  {
    label: 'Снять отметку',
    icon: STATE_UI.unassessed.icon,
    onSelect: () => emit('mark', props.item.id, { status: null })
  }
]]);

const editingNote = ref(false);
const draftNote = ref('');
function openNote() {
  draftNote.value = props.item.note ?? '';
  editingNote.value = true;
}
function commitNote() {
  editingNote.value = false;
  if (draftNote.value.trim() !== (props.item.note ?? '')) emit('mark', props.item.id, { note: draftNote.value });
}
</script>

<template>
  <li>
    <div
      class="group flex items-center gap-1 rounded py-1 pr-1 hover:bg-elevated"
      :class="dimmed ? 'opacity-60' : ''"
    >
      <UButton
        v-if="children.length > 0"
        :icon="isOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
        size="xs"
        variant="ghost"
        color="neutral"
        :aria-label="isOpen ? 'Свернуть' : 'Развернуть'"
        @click="emit('toggle', item.id)"
      />
      <span v-else class="inline-block w-6" />

      <!-- Нижняя возможность — значок-меню состояния; у родителя состояния
           нет, показан счёт нижних (docs/07-maps.md, «Состояние реализации»). -->
      <UDropdownMenu v-if="isLeaf" :items="menu" :content="{ align: 'start' }">
        <UButton
          size="xs"
          variant="ghost"
          :color="STATE_UI[state].color"
          :icon="STATE_UI[state].icon"
          :class="marked.has(item.id) ? 'ring-2 ring-primary' : ''"
          :aria-label="`Состояние: ${STATE_LABEL[state]}. Изменить`"
          :title="marked.has(item.id) ? `${STATE_LABEL[state]} — не сохранено` : STATE_LABEL[state]"
        />
      </UDropdownMenu>
      <UIcon
        v-else
        :name="STATE_UI[state].icon"
        class="mx-1.5 size-4 shrink-0"
        :class="{
          'text-success': STATE_UI[state].color === 'success',
          'text-warning': STATE_UI[state].color === 'warning',
          'text-error': STATE_UI[state].color === 'error',
          'text-dimmed': STATE_UI[state].color === 'neutral'
        }"
        :title="STATE_LABEL[state]"
      />

      <button
        type="button"
        class="min-w-0 flex-1 truncate text-left text-sm hover:underline"
        @click="emit('select', item)"
      >
        {{ item.title ?? item.id }}
      </button>

      <span v-if="!isLeaf && own" class="hidden shrink-0 text-xs text-muted sm:inline">{{ tallyText(own.tally) }}</span>

      <!-- Что сделано и чего не хватает: видно без клика, правится по клику. -->
      <button
        v-if="isLeaf && item.note && !editingNote"
        type="button"
        class="hidden max-w-[40%] shrink truncate text-xs text-muted hover:underline md:inline"
        :title="item.note"
        @click="openNote"
      >
        {{ item.note }}
      </button>

      <UBadge v-if="item.pending && !quiet" size="xs" color="neutral" variant="subtle">ещё не устоялось</UBadge>

      <!-- Кнопки — на весь ряд по наведению, не всегда видны: дерево читают чаще, чем правят. -->
      <div class="hidden shrink-0 gap-1 group-hover:flex">
        <UButton
          v-if="isLeaf && item.status && !editingNote"
          icon="i-lucide-message-square-text"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Что сделано и чего не хватает"
          @click="openNote"
        />
        <UButton
          icon="i-lucide-plus"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Добавить подпункт"
          @click="emit('add-child', item.id)"
        />
        <UButton
          icon="i-lucide-pencil"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Переименовать"
          @click="emit('edit', item)"
        />
        <UButton
          icon="i-lucide-trash-2"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Убрать"
          @click="emit('remove', item)"
        />
      </div>
    </div>

    <div v-if="editingNote" class="mb-1 ml-14 flex items-center gap-2">
      <UInput
        v-model="draftNote"
        class="flex-1"
        size="xs"
        autofocus
        placeholder="Что сделано и чего не хватает — одна-две фразы"
        @keyup.enter="commitNote"
        @keyup.esc="editingNote = false"
        @blur="commitNote"
      />
    </div>

    <ul v-if="isOpen && children.length > 0" class="ml-3 border-l border-default pl-3">
      <FunctionalTreeNode
        v-for="child in children"
        :key="child.id"
        :item="child"
        :children="childrenOf(child.id)"
        :all-capabilities="allCapabilities"
        :expanded="expanded"
        :summary="summary"
        :visible="visible"
        :marked="marked"
        :quiet="quiet"
        @toggle="(id) => emit('toggle', id)"
        @select="(value) => emit('select', value)"
        @add-child="(id) => emit('add-child', id)"
        @edit="(value) => emit('edit', value)"
        @remove="(value) => emit('remove', value)"
        @mark="(id, patch) => emit('mark', id, patch)"
      />
    </ul>
  </li>
</template>
