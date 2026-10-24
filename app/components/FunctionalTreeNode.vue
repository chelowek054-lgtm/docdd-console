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
const { t } = useT();

export interface Capability {
  id: string;
  title?: string;
  parent?: string;
  summary?: string;
  status?: ImplStatus;
  note?: string;
  priority?: Priority;
  horizon?: Horizon; owner?: string;
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
  hover: [item: Capability, anchor: HTMLElement];
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
  return t('t83.m2.ftn.waits', { list: ids.map(titleOf).join(', ') });
});

// Что стоит за отметкой в процессе (docs/07-maps.md, «Покрытие процессом»).
const tasks = computed(() => tasksText(view.value?.coverage));
const checks = computed(() => {
  const cover = view.value?.coverage;
  if (!cover || cover.verifications.ids.length === 0) return null;
  const { passed, failed, ids } = cover.verifications;
  if (failed > 0) return { icon: 'i-lucide-circle-x', text: 'text-error', title: t('t83.m2.ftn.failed', { failed, total: ids.length }) };
  if (passed === ids.length) return { icon: 'i-lucide-check', text: 'text-success', title: t('t83.m2.ftn.passed', { passed, total: ids.length }) };
  return { icon: 'i-lucide-dot', text: 'text-muted', title: t('t83.m2.ftn.partial', { passed, total: ids.length }) };
});
// «Нет следа» — только у нижней возможности и только когда покрытие загружено.
const noTrace = computed(() => !isParent.value && view.value?.coverage?.level === 'none');
const consistency = computed(() => (view.value?.flags ?? []).filter((flag) => flag === 'ahead' || flag === 'behind'));

// Меню состояния создаём только после нажатия: на сотнях строк оно не нужно.
const menuOn = ref(false);
const SOFT = { success: 'bg-success/10 text-success', warning: 'bg-warning/10 text-warning', error: 'bg-error/10 text-error', neutral: 'bg-elevated text-default' } as const;
const statusBtn = computed(() => `ds-hit inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${SOFT[BADGE_COLOR[key.value]]}`);
const statusTitle = computed(() => t('t83.m2.ftn.state', { label: IMPL_LABEL[key.value] }));

function onRow(event: Event) {
  const anchor = (event.currentTarget as HTMLElement).querySelector<HTMLElement>('[data-anchor]');
  if (anchor) emit('hover', props.item, anchor);
}
</script>

<template>
  <li>
    <div
      class="group flex items-start gap-1 rounded py-1 pr-1 hover:bg-elevated"
      :class="item.pending && !hidePending ? 'opacity-60' : ''"
      @mouseenter="onRow"
      @focusin="onRow"
    >
      <button
        v-if="children.length > 0"
        type="button"
        class="ds-hit inline-flex size-6 shrink-0 items-center justify-center rounded text-default hover:bg-elevated"
        :aria-label="isOpen ? t('t83.m2.collapse') : t('t83.m2.expand')"
        @click="emit('toggle', item.id)"
      >
        <UIcon :name="isOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
      </button>
      <span v-else class="inline-block w-6 shrink-0" />

      <div class="min-w-0 flex-1" data-anchor>
        <button
          type="button"
          class="block max-w-full truncate text-left text-sm hover:underline"
          @click="emit('select', item)"
        >
          {{ item.title ?? item.id }}
        </button>

        <!-- Приоритет, горизонт и то, что за отметкой стоит в процессе; унаследованное приглушено. -->
        <div
          v-if="view && (view.priority || view.horizon || view.owner || tasks || checks || noTrace || view.replacedBy.length || consistency.length)"
          class="mt-0.5 flex flex-wrap items-center gap-1"
        >
          <LightBadge
            v-if="view.priority"
           
            variant="subtle"
            :color="PRIORITY_COLOR[view.priority.value]"
            :class="view.priority.inherited ? 'opacity-60' : ''"
            :title="view.priority.inherited ? t('t83.m2.ftn.prioInh', { from: titleOf(view.priority.from) }) : t('t83.m2.ftn.priority')"
          >
            {{ PRIORITY_LABEL[view.priority.value] }}
          </LightBadge>
          <LightBadge
            v-if="view.horizon"
           
            variant="outline"
            color="neutral"
            :class="view.horizon.inherited ? 'opacity-60' : ''"
            :title="view.horizon.inherited ? t('t83.m2.ftn.horInh', { from: titleOf(view.horizon.from) }) : t('t83.m2.ftn.horizon')"
          >
            {{ HORIZON_LABEL[view.horizon.value] }}
          </LightBadge>

          <LightBadge v-if="view.owner" variant="outline" color="neutral" :class="view.owner.inherited ? 'opacity-60' : ''" :title="view.owner.inherited ? t('t83.m2.ftn.ownInh', { from: titleOf(view.owner.from) }) : t('t83.m2.ftn.owner')">{{ view.owner.value }}</LightBadge>
          <span v-if="tasks" class="text-xs text-muted" :title="t('t83.functional-tree-node.1')">{{ tasks }}</span>
          <UIcon v-if="checks" :name="checks.icon" class="size-4" :class="checks.text" :title="checks.title" />
          <span v-if="noTrace" class="text-xs text-dimmed" :title="t('t83.functional-tree-node.2')">{{ t('t83.functional-tree-node.3') }}</span>
          <LightBadge
            v-for="flag in consistency"
            :key="flag"
           
            variant="subtle"
            color="warning"
          >
            {{ RISK_LABEL[flag] }}
          </LightBadge>
          <LightBadge v-if="view.replacedBy.length" variant="subtle" color="warning">
            {{ t('t83.functional-tree-node.4', { p: view.replacedBy.map(titleOf).join(', ') }) }}
          </LightBadge>
        </div>

        <p v-if="item.note && !isParent" class="text-xs text-muted">{{ item.note }}</p>
      </div>

      <LightBadge v-if="item.pending && !hidePending" color="neutral" variant="subtle">{{ t('t83.functional-tree-node.5') }}</LightBadge>
      <LightBadge v-if="view?.inCycle" color="error" variant="subtle" :title="t('t83.functional-tree-node.6')">
        {{ t('t83.functional-tree-node.7') }}
      </LightBadge>
      <LightBadge v-else-if="waitingTitle" color="warning" variant="subtle" :title="waitingTitle">
        {{ waitingTitle }}
      </LightBadge>

      <!-- Кнопки действий — одна панель на всё дерево, см. FunctionalTree.vue. -->

      <span v-if="unsaved" class="mt-1 text-xs text-warning" :title="t('t83.functional-tree-node.8')">●</span>

      <!-- Лист — кнопка с меню отметок; у родителя состояние производное, менять его нечем. -->
      <UDropdownMenu v-if="!isParent && menuOn" :items="menu" :default-open="true" @update:open="(open) => { if (!open) menuOn = false; }">
        <button type="button" :class="statusBtn" :title="statusTitle">
          <UIcon :name="STATUS_STYLE[key].icon" class="size-4" />{{ IMPL_LABEL[key] }}
        </button>
      </UDropdownMenu>
      <button v-else-if="!isParent" type="button" :class="statusBtn" :title="statusTitle" @click="menuOn = true">
        <UIcon :name="STATUS_STYLE[key].icon" class="size-4" />{{ IMPL_LABEL[key] }}
      </button>
      <LightBadge v-else :color="BADGE_COLOR[key]" :title="view ? statusText(view) : ''">
        <UIcon :name="STATUS_STYLE[key].icon" class="size-4" />{{ view?.progress ? `${view.progress.implemented} из ${view.progress.total}` : IMPL_LABEL[key] }}
      </LightBadge>
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
