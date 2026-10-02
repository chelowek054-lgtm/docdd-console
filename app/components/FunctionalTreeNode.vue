<script setup lang="ts">
import {
  HORIZON_LABEL,
  IMPL_LABEL,
  PRIORITY_LABEL,
  type Horizon,
  type ImplStatus,
  type Mark,
  type Priority
} from '../../server/lib/functional';
import { RISK_LABEL, STATUS_STYLE, statusText, tasksText, type CapabilityView } from '~/utils/functional-view';

export interface Capability {
  id: string;
  title?: string;
  parent?: string;
  summary?: string;
  status?: ImplStatus;
  note?: string;
  priority?: Priority;
  horizon?: Horizon;
  declaredBy?: string;
  declaredAt?: string;
  declaredByRole?: string | null;
  pending?: boolean;
}

const props = defineProps<{
  item: Capability;
  children: Capability[];
  /** Видимый список (под фильтром): подпункты ищутся в нём, а не во всей карте. */
  allCapabilities: Capability[];
  views: ReadonlyMap<string, CapabilityView>;
  marks: Readonly<Record<string, Mark>>;
  /** Карта ещё не устоялась у всех возможностей разом — бейдж на каждой строке ничего бы не отличал. */
  hidePending: boolean;
  expanded: ReadonlySet<string>;
}>();

const emit = defineEmits<{
  toggle: [id: string];
  select: [item: Capability];
  'add-child': [parentId: string];
  edit: [item: Capability];
  relate: [item: Capability];
  remove: [item: Capability];
  mark: [id: string, status: ImplStatus | null];
}>();

const isOpen = computed(() => props.expanded.has(props.item.id));
const view = computed(() => props.views.get(props.item.id));
const key = computed(() => view.value?.status ?? 'unrated');
const unsaved = computed(() => props.item.id in props.marks);
const isParent = computed(() => props.children.length > 0);

function childrenOf(id: string): Capability[] {
  return props.allCapabilities.filter((item) => item.parent === id);
}

const BADGE_COLOR = { implemented: 'success', partial: 'warning', not_implemented: 'error', unrated: 'neutral' } as const;
const PRIORITY_COLOR = { must: 'primary', should: 'info', could: 'neutral', wont: 'neutral' } as const;

const menu = computed(() => [(['implemented', 'partial', 'not_implemented', 'unrated'] as const).map((value) => ({
  label: IMPL_LABEL[value],
  icon: STATUS_STYLE[value].icon,
  onSelect: () => emit('mark', props.item.id, value === 'unrated' ? null : value)
}))]);

const titleOf = (id: string) => props.allCapabilities.find((item) => item.id === id)?.title ?? id;

const waitingTitle = computed(() => {
  const ids = view.value?.waiting ?? [];
  if (ids.length === 0) return '';
  return `ждёт: ${ids.map(titleOf).join(', ')}`;
});

// Что стоит за отметкой в процессе (docs/07-maps.md, «Покрытие процессом»).
const tasks = computed(() => tasksText(view.value?.coverage));
const checks = computed(() => {
  const cover = view.value?.coverage;
  if (!cover || cover.verifications.ids.length === 0) return null;
  const { passed, failed, ids } = cover.verifications;
  if (failed > 0) return { icon: 'i-lucide-circle-x', text: 'text-error', title: `Проверка падает: ${failed} из ${ids.length}` };
  if (passed === ids.length) return { icon: 'i-lucide-check', text: 'text-success', title: `Проверки прошли: ${passed} из ${ids.length}` };
  return { icon: 'i-lucide-dot', text: 'text-muted', title: `Прошли ${passed} из ${ids.length}, остальные не запускались` };
});
// «Нет следа» — только у нижней возможности и только когда покрытие загружено.
const noTrace = computed(() => !isParent.value && view.value?.coverage?.level === 'none');
const consistency = computed(() => (view.value?.flags ?? []).filter((flag) => flag === 'ahead' || flag === 'behind'));
</script>

<template>
  <li>
    <div
      class="group flex items-start gap-1 rounded py-1 pr-1 hover:bg-elevated"
      :class="item.pending && !hidePending ? 'opacity-60' : ''"
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
      <span v-else class="inline-block w-6 shrink-0" />

      <div class="min-w-0 flex-1">
        <button
          type="button"
          class="block max-w-full truncate text-left text-sm hover:underline"
          @click="emit('select', item)"
        >
          {{ item.title ?? item.id }}
        </button>

        <!-- Приоритет, горизонт и то, что за отметкой стоит в процессе; унаследованное приглушено. -->
        <div
          v-if="view && (view.priority || view.horizon || tasks || checks || noTrace || view.replacedBy.length || consistency.length)"
          class="mt-0.5 flex flex-wrap items-center gap-1"
        >
          <UBadge
            v-if="view.priority"
            size="xs"
            variant="subtle"
            :color="PRIORITY_COLOR[view.priority.value]"
            :class="view.priority.inherited ? 'opacity-60' : ''"
            :title="view.priority.inherited ? `Приоритет унаследован от «${titleOf(view.priority.from)}»` : 'Приоритет'"
          >
            {{ PRIORITY_LABEL[view.priority.value] }}
          </UBadge>
          <UBadge
            v-if="view.horizon"
            size="xs"
            variant="outline"
            color="neutral"
            :class="view.horizon.inherited ? 'opacity-60' : ''"
            :title="view.horizon.inherited ? `Горизонт унаследован от «${titleOf(view.horizon.from)}»` : 'Горизонт'"
          >
            {{ HORIZON_LABEL[view.horizon.value] }}
          </UBadge>
          <span v-if="tasks" class="text-xs text-muted" title="Задачи, связанные с возможностью через её карту">{{ tasks }}</span>
          <UIcon v-if="checks" :name="checks.icon" class="size-4" :class="checks.text" :title="checks.title" />
          <span v-if="noTrace" class="text-xs text-dimmed" title="Ни требований, ни задач за этой возможностью нет">нет следа</span>
          <UBadge
            v-for="flag in consistency"
            :key="flag"
            size="xs"
            variant="subtle"
            color="warning"
          >
            {{ RISK_LABEL[flag] }}
          </UBadge>
          <UBadge v-if="view.replacedBy.length" size="xs" variant="subtle" color="warning">
            заменяется на {{ view.replacedBy.map(titleOf).join(', ') }}
          </UBadge>
        </div>

        <p v-if="item.note && !isParent" class="text-xs text-muted">{{ item.note }}</p>
      </div>

      <UBadge v-if="item.pending && !hidePending" size="xs" color="neutral" variant="subtle">ещё не устоялось</UBadge>
      <UBadge v-if="view?.inCycle" size="xs" color="error" variant="subtle" title="Две возможности ждут друг друга — граница проведена неверно">
        цикл
      </UBadge>
      <UBadge v-else-if="waitingTitle" size="xs" color="warning" variant="subtle" :title="waitingTitle">
        {{ waitingTitle }}
      </UBadge>

      <!-- Кнопки — на весь ряд по наведению, не всегда видны: дерево читают чаще, чем правят. -->
      <div class="hidden shrink-0 gap-1 group-hover:flex">
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
          title="Переименовать, описание, состояние, приоритет"
          @click="emit('edit', item)"
        />
        <UButton
          icon="i-lucide-link"
          size="xs"
          variant="ghost"
          color="neutral"
          title="Связать с другой возможностью"
          @click="emit('relate', item)"
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

      <span v-if="unsaved" class="mt-1 text-xs text-warning" title="Отметка не сохранена">●</span>

      <!-- Лист — кнопка с меню отметок; у родителя состояние производное, менять его нечем. -->
      <UDropdownMenu v-if="!isParent" :items="menu">
        <UButton
          size="xs"
          variant="subtle"
          :color="BADGE_COLOR[key]"
          :icon="STATUS_STYLE[key].icon"
          :title="'Состояние: ' + IMPL_LABEL[key] + '. Нажмите, чтобы отметить'"
        >
          {{ IMPL_LABEL[key] }}
        </UButton>
      </UDropdownMenu>
      <UBadge
        v-else
        size="md"
        variant="subtle"
        :color="BADGE_COLOR[key]"
        :icon="STATUS_STYLE[key].icon"
        :title="view ? statusText(view) : ''"
      >
        {{ view?.progress ? `${view.progress.implemented} из ${view.progress.total}` : IMPL_LABEL[key] }}
      </UBadge>
    </div>

    <ul v-if="isOpen && children.length > 0" class="ml-3 border-l border-default pl-3">
      <FunctionalTreeNode
        v-for="child in children"
        :key="child.id"
        :item="child"
        :children="childrenOf(child.id)"
        :all-capabilities="allCapabilities"
        :views="views"
        :marks="marks"
        :hide-pending="hidePending"
        :expanded="expanded"
        @toggle="(id) => emit('toggle', id)"
        @select="(value) => emit('select', value)"
        @add-child="(id) => emit('add-child', id)"
        @edit="(value) => emit('edit', value)"
        @relate="(value) => emit('relate', value)"
        @remove="(value) => emit('remove', value)"
        @mark="(id, status) => emit('mark', id, status)"
      />
    </ul>
  </li>
</template>
