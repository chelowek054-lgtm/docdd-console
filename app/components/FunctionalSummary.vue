<script setup lang="ts">
import { STATE_LABEL, STATE_ORDER, type CapabilityState, type Tally } from '~~/server/lib/functional';

/**
 * Сводка над деревом и графом: цветная полоса из четырёх долей и счёт по
 * нижним возможностям (docs/04-ui.md, «Функциональная карта»). Клик по счёту
 * фильтрует — повторный снимает фильтр.
 */
const props = defineProps<{
  tally: Tally;
  filter: CapabilityState | null;
}>();

const emit = defineEmits<{ filter: [state: CapabilityState | null] }>();

function share(state: CapabilityState): number {
  return props.tally.total === 0 ? 0 : (props.tally[state] / props.tally.total) * 100;
}

function pick(state: CapabilityState) {
  emit('filter', props.filter === state ? null : state);
}
</script>

<template>
  <div v-if="tally.total > 0" class="mb-3 rounded-lg border border-default p-3">
    <div class="flex h-2 overflow-hidden rounded-full bg-elevated" role="img" :aria-label="`Нижних возможностей: ${tally.total}`">
      <div
        v-for="state in STATE_ORDER"
        :key="state"
        :class="STATE_UI[state].bar"
        :style="{ width: `${share(state)}%` }"
      />
    </div>
    <div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <UButton
        v-for="state in STATE_ORDER"
        :key="state"
        size="xs"
        :color="STATE_UI[state].color"
        :variant="filter === state ? 'solid' : 'ghost'"
        :icon="STATE_UI[state].icon"
        :disabled="tally[state] === 0"
        :aria-pressed="filter === state"
        @click="pick(state)"
      >
        {{ STATE_LABEL[state] }} · {{ tally[state] }}
      </UButton>
      <span class="ml-auto text-xs text-muted">всего нижних: {{ tally.total }}</span>
    </div>
  </div>
</template>
