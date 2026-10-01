<script setup lang="ts">
import { STATE_LABEL, STATE_ORDER } from '~~/server/lib/functional';

/**
 * Легенда графа состояния: цвет — состояние реализации, линия — вид связи
 * (docs/04-ui.md, «Функциональная карта»). Рядом с диаграммой, а не внутри неё:
 * mermaid легенды не рисует, а подпись, которую нужно искать в тексте диаграммы,
 * — не легенда.
 */
const ARROWS = [
  { kind: 'depends', label: 'зависит от', dash: '', width: 2 },
  { kind: 'uses', label: 'пользуется', dash: '5 4', width: 2 },
  { kind: 'feeds', label: 'передаёт данные', dash: '', width: 4 }
] as const;
</script>

<template>
  <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
    <span v-for="state in STATE_ORDER" :key="state" class="inline-flex items-center gap-1">
      <span class="inline-block size-3 rounded-sm" :class="STATE_UI[state].bar" />
      {{ STATE_LABEL[state] }}
    </span>
    <span class="text-dimmed">|</span>
    <span v-for="arrow in ARROWS" :key="arrow.kind" class="inline-flex items-center gap-1">
      <svg width="28" height="10" viewBox="0 0 28 10" aria-hidden="true">
        <line x1="1" y1="5" x2="22" y2="5" stroke="currentColor" :stroke-width="arrow.width" :stroke-dasharray="arrow.dash" />
        <path d="M21 1 L27 5 L21 9 Z" fill="currentColor" />
      </svg>
      {{ arrow.label }}
    </span>
    <span class="inline-flex items-center gap-1">
      <span class="inline-block h-0 w-5 border-t-2 border-dashed border-error" />
      круг
    </span>
  </div>
</template>
