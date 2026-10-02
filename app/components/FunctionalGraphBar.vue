<script setup lang="ts">
import {
  HORIZONS,
  HORIZON_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  RELATION_LABEL,
  RELATION_TYPES,
  type Horizon,
  type Priority
} from '../../server/lib/functional';
import { FUNCTIONAL_MODE_LABEL, type FunctionalLevel, type FunctionalMode } from '~/utils/map-mermaid';

/**
 * Управление графом состояния: уровень (группы / всё), режим окраски и
 * фильтры (docs/04-ui.md, «Уровни графа», «Режимы окраски», «Фильтры»).
 * Все они только читают: ничего не пишут и не меняют карту.
 */
const props = defineProps<{
  level: FunctionalLevel;
  /** Можно ли переключать уровни: групп хотя бы две. */
  canSwitch: boolean;
  /** Название открытой группы — для пути «Все группы › Оплата». */
  groupTitle: string;
  /** Покрытие загружено: без него режимы «Покрытие» и «Риски» нечем красить. */
  hasCoverage: boolean;
  /** Сколько связей каждого вида на карте — чип показывается только у существующих. */
  kindCounts: Record<string, number>;
}>();

const emit = defineEmits<{
  'show-groups': [];
  'show-all': [];
}>();

const mode = defineModel<FunctionalMode>('mode', { required: true });
const hiddenKinds = defineModel<string[]>('hiddenKinds', { required: true });
const priority = defineModel<Priority | 'none' | null>('priority', { required: true });
const horizon = defineModel<Horizon | 'none' | null>('horizon', { required: true });
const onlyRisks = defineModel<boolean>('onlyRisks', { required: true });

const modeItems = computed(() => (Object.keys(FUNCTIONAL_MODE_LABEL) as FunctionalMode[]).map((value) => ({
  label: FUNCTIONAL_MODE_LABEL[value],
  value,
  // Без покрытия «Покрытие» и «Риски» красить нечем — и кнопка называет причину в подсказке.
  disabled: !props.hasCoverage && (value === 'coverage' || value === 'risks')
})));

const kinds = computed(() => RELATION_TYPES.filter((type) => (props.kindCounts[type] ?? 0) > 0));

function toggleKind(type: string) {
  hiddenKinds.value = hiddenKinds.value.includes(type)
    ? hiddenKinds.value.filter((item) => item !== type)
    : [...hiddenKinds.value, type];
}

const priorityItems = [
  { label: 'Любой приоритет', value: 'all' as const },
  ...PRIORITIES.map((value) => ({ label: PRIORITY_LABEL[value], value })),
  { label: 'Без приоритета', value: 'none' as const }
];
const horizonItems = [
  { label: 'Любой горизонт', value: 'all' as const },
  ...HORIZONS.map((value) => ({ label: HORIZON_LABEL[value], value })),
  { label: 'Без горизонта', value: 'none' as const }
];
</script>

<template>
  <div class="mb-3 space-y-2">
    <div class="flex flex-wrap items-center gap-3">
      <div v-if="canSwitch" class="flex gap-1">
        <UButton
          size="xs"
          :variant="level === 'all' ? 'outline' : 'solid'"
          color="neutral"
          icon="i-lucide-boxes"
          @click="emit('show-groups')"
        >
          Группы
        </UButton>
        <UButton
          size="xs"
          :variant="level === 'all' ? 'solid' : 'outline'"
          color="neutral"
          icon="i-lucide-network"
          @click="emit('show-all')"
        >
          Всё
        </UButton>
      </div>

      <p v-if="level === 'group'" class="text-sm text-muted">
        <button type="button" class="hover:underline" @click="emit('show-groups')">Все группы</button>
        › {{ groupTitle }}
      </p>

      <div class="ml-auto flex items-center gap-2">
        <span class="text-xs text-muted">Окраска</span>
        <UTabs v-model="mode" size="xs" class="w-80" :items="modeItems" />
      </div>
    </div>
    <p v-if="!hasCoverage" class="text-xs text-muted">
      «Покрытие» и «Риски» станут доступны, когда загрузится то, что стоит за возможностями в процессе.
    </p>

    <div class="flex flex-wrap items-center gap-2 text-xs">
      <span class="text-muted">Связи</span>
      <UButton
        v-for="type in kinds"
        :key="type"
        size="xs"
        color="neutral"
        :variant="hiddenKinds.includes(type) ? 'outline' : 'subtle'"
        :title="hiddenKinds.includes(type) ? 'Показать' : 'Скрыть'"
        @click="toggleKind(type)"
      >
        {{ RELATION_LABEL[type] }} · {{ kindCounts[type] }}
      </UButton>
      <span v-if="kinds.length === 0" class="text-muted">пока нет</span>

      <USelect
        class="ml-auto w-44"
        size="xs"
        :model-value="priority ?? 'all'"
        :items="priorityItems"
        @update:model-value="(value) => (priority = value === 'all' ? null : (value as Priority | 'none'))"
      />
      <USelect
        class="w-40"
        size="xs"
        :model-value="horizon ?? 'all'"
        :items="horizonItems"
        @update:model-value="(value) => (horizon = value === 'all' ? null : (value as Horizon | 'none'))"
      />
      <UButton
        size="xs"
        color="neutral"
        :variant="onlyRisks ? 'solid' : 'outline'"
        :disabled="!hasCoverage"
        title="Оставить возможности с признаком риска и их родителей"
        @click="onlyRisks = !onlyRisks"
      >
        Только риски
      </UButton>
    </div>
  </div>
</template>
