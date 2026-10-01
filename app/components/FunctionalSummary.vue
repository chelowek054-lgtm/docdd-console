<script setup lang="ts">
import { IMPL_LABEL, type Progress, type StatusFilter } from '../../server/lib/functional';
import { STATUS_STYLE } from '~/utils/functional-view';

/**
 * Сводка над деревом и графом функциональной карты: сколько возможностей в
 * каком состоянии (docs/04-ui.md, «Функциональная карта»). Клик по счёту —
 * фильтр: остаётся только это состояние, повторный клик снимает. Состояние
 * не только цветом: рядом слово и значок.
 */
const props = defineProps<{
  progress: Progress;
}>();

const filter = defineModel<StatusFilter | null>('filter', { default: null });

const order: StatusFilter[] = ['implemented', 'partial', 'not_implemented', 'unrated'];

function share(key: StatusFilter): number {
  return props.progress.total === 0 ? 0 : (props.progress[key] / props.progress.total) * 100;
}

function toggle(key: StatusFilter) {
  filter.value = filter.value === key ? null : key;
}
</script>

<template>
  <div class="mb-3 space-y-2">
    <div
      class="flex h-2 overflow-hidden rounded-full bg-elevated"
      role="img"
      :aria-label="order.map((key) => `${IMPL_LABEL[key]}: ${progress[key]}`).join(', ')"
    >
      <div
        v-for="key in order"
        :key="key"
        :style="{ width: `${share(key)}%`, backgroundColor: STATUS_STYLE[key].stroke, opacity: key === 'unrated' ? 0.35 : 1 }"
      />
    </div>

    <div class="flex flex-wrap items-center gap-1">
      <UButton
        v-for="key in order"
        :key="key"
        size="xs"
        color="neutral"
        :variant="filter === key ? 'solid' : 'outline'"
        :icon="STATUS_STYLE[key].icon"
        :class="filter === key ? '' : STATUS_STYLE[key].text"
        :aria-pressed="filter === key"
        :title="filter === key ? 'Снять фильтр' : `Показать только: ${IMPL_LABEL[key]}`"
        @click="toggle(key)"
      >
        {{ IMPL_LABEL[key] }} {{ progress[key] }}
      </UButton>
      <span class="ml-1 text-xs text-muted">из {{ progress.total }}</span>
      <UButton v-if="filter" size="xs" variant="link" color="neutral" @click="filter = null">Показать все</UButton>
    </div>
  </div>
</template>
