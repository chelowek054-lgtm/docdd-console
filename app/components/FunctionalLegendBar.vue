<script setup lang="ts">
import type { FunctionalLegend } from '~/utils/map-mermaid';

/**
 * Легенда графа состояния — полоса над схемой, вне холста (docs/04-ui.md,
 * «Легенда — над схемой»). Только то, что нарисовано, и с числом: данные те же,
 * что строят схему, поэтому разойтись с ней легенда не может.
 */
defineProps<{ legend: FunctionalLegend }>();

/** Образец стрелки вида связи: тот же стиль, что на схеме. */
const SAMPLE: Record<string, { color?: string; width: number; dash?: string; end?: 'dot' | 'cross' }> = {
  depends: { width: 2 },
  uses: { width: 2, dash: '3 3' },
  feeds: { width: 4 },
  triggers: { width: 2, color: '#7C3AED', end: 'dot' },
  replaces: { width: 2, color: '#6B7280', end: 'cross' }
};
</script>

<template>
  <div class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
    <span v-for="entry in legend.entries" :key="entry.key" class="flex items-center gap-1">
      <span
        class="inline-block h-3 w-5 rounded-sm border-2"
        :class="entry.dash ? 'border-dashed' : ''"
        :style="{ backgroundColor: entry.fill, borderColor: entry.stroke }"
      />
      {{ entry.label }} · {{ entry.count }}
    </span>

    <span v-for="item in legend.kinds" :key="item.kind" class="flex items-center gap-1">
      <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true">
        <line
          x1="1"
          y1="5"
          :x2="SAMPLE[item.kind]?.end ? 22 : 29"
          y2="5"
          :stroke="SAMPLE[item.kind]?.color ?? 'currentColor'"
          :stroke-width="SAMPLE[item.kind]?.width ?? 2"
          :stroke-dasharray="SAMPLE[item.kind]?.dash"
        />
        <circle v-if="SAMPLE[item.kind]?.end === 'dot'" cx="26" cy="5" r="3" :fill="SAMPLE[item.kind]?.color" />
        <path v-if="SAMPLE[item.kind]?.end === 'cross'" d="M23 2 L29 8 M29 2 L23 8" :stroke="SAMPLE[item.kind]?.color" stroke-width="2" />
      </svg>
      {{ item.text }} · {{ item.count }}
    </span>

    <span v-if="legend.hints.waits" class="flex items-center gap-1">
      <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5" stroke="#D97706" stroke-width="2" /></svg>
      жёлтая — ждёт зависимость · {{ legend.hints.waits }}
    </span>
    <span v-if="legend.hints.cycles" class="flex items-center gap-1">
      <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true"><line x1="1" y1="5" x2="29" y2="5" stroke="#DC2626" stroke-width="3" /></svg>
      красная — ждут друг друга · {{ legend.hints.cycles }}
    </span>

    <span v-if="legend.kinds.length === 0">Связей между возможностями пока нет</span>
  </div>
</template>
