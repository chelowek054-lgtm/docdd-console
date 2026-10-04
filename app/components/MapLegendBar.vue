<script setup lang="ts">
import type { MapLegendItem } from '~/utils/map-mermaid';

/**
 * Легенда вкладок «Кодовая база», «Потоки данных», «Пользовательские пути» —
 * полоса над схемой, вне холста (docs/04-ui.md, «Легенда кодовой базы, потоков и
 * путей»). Только то, что нарисовано, и с числом; клик по строке ничего не делает.
 */
defineProps<{ items: MapLegendItem[] }>();

const SHAPE = { box: 'rounded-sm', cylinder: 'rounded-[45%]', stadium: 'rounded-full' } as const;
</script>

<template>
  <div v-if="items.length" class="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
    <template v-for="(item, at) in items" :key="at">
      <span v-if="item.kind === 'swatch'" class="flex items-center gap-1">
        <span
          class="inline-block h-3 w-5 border"
          :class="[SHAPE[item.shape ?? 'box'], item.dash ? 'border-dashed' : '', item.faded ? 'opacity-50' : '']"
          :style="{ backgroundColor: item.fill, borderColor: item.stroke, borderWidth: item.thick ? '3px' : '1px' }"
        />
        {{ item.label }}<template v-if="item.count"> · {{ item.count }}</template>
      </span>

      <span v-else-if="item.kind === 'arrow'" class="flex items-center gap-1">
        <svg width="30" height="10" viewBox="0 0 30 10" aria-hidden="true">
          <line
            x1="1"
            y1="5"
            x2="26"
            y2="5"
            :stroke="item.color ?? 'currentColor'"
            :stroke-width="item.line === 'thick' ? 4 : 2"
            :stroke-dasharray="item.line === 'dashed' ? '3 3' : undefined"
          />
          <path d="M24 1 L29 5 L24 9 Z" :fill="item.color ?? 'currentColor'" />
        </svg>
        {{ item.label }}<template v-if="item.count"> · {{ item.count }}</template>
      </span>

      <span v-else>{{ item.label }}<template v-if="item.count"> · {{ item.count }}</template></span>
    </template>
  </div>
</template>
