<script setup lang="ts">
import { legendOf, standardFor, tokenColor } from '~~/server/lib/map-core';

/**
 * «Обозначения» карты (R-0143, A-0010 п. 4–6): легенда из стандарта типа, а не из кода компонента —
 * новый шаблон приносит свой стандарт и интерфейс не правит. Цвета — токены, значение по теме.
 * Свёрнуто по умолчанию: нужно, когда читаешь карту впервые.
 */
const props = defineProps<{ template: string }>();
const { t } = useT();
const colorMode = useColorMode();

const standard = computed(() => standardFor(props.template)?.standard ?? null);
const rows = computed(() => (standard.value ? legendOf(standard.value) : []));
const theme = computed(() => (colorMode.value === 'dark' ? 'dark' : 'light'));
const color = (name?: string) => (name ? tokenColor(name, theme.value) ?? undefined : undefined);
const DASH: Record<string, string | undefined> = { solid: undefined, dashed: '6 4', dotted: '2 3' };
const open = ref(false);
</script>

<template>
  <div v-if="standard" class="mb-2 text-xs">
    <button type="button" class="flex items-center gap-1 text-muted" :aria-expanded="open" @click="open = !open">
      <UIcon :name="open ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-3.5" />
      {{ t('maps.notation.title', { title: standard.title }) }}
    </button>
    <div v-if="open" class="mt-2 space-y-2 ds-card p-2">
      <p class="text-muted">{{ standard.question }}. {{ t('maps.notation.sources') }}: {{ standard.sources.map((item) => item.name).join('; ') }}.</p>
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span v-for="row in rows.filter((item) => item.kind === 'node')" :key="`n-${row.id}`" class="flex items-center gap-1">
          <span class="inline-block h-3 w-1.5 rounded-sm" :style="{ backgroundColor: color(row.color) }" />
          <UIcon v-if="row.icon" :name="row.icon" class="size-3.5" :style="{ color: color(row.color) }" />
          {{ row.title }}
        </span>
      </div>
      <div class="flex flex-wrap gap-x-4 gap-y-1">
        <span v-for="row in rows.filter((item) => item.kind === 'edge')" :key="`e-${row.id}`" class="flex items-center gap-1">
          <svg width="28" height="10" aria-hidden="true">
            <line x1="2" y1="5" x2="24" y2="5" stroke="currentColor" stroke-width="1.5" :stroke-dasharray="DASH[row.line ?? 'solid']" />
            <path v-if="row.head === 'arrow'" d="M20 1 L26 5 L20 9 Z" fill="currentColor" />
            <path v-else-if="row.head === 'open'" d="M20 1 L26 5 L20 9" fill="none" stroke="currentColor" stroke-width="1.5" />
            <path v-if="row.twoWay" d="M8 1 L2 5 L8 9 Z" fill="currentColor" />
          </svg>
          {{ row.title }}<span v-if="row.label === 'format'" class="text-muted"> · {{ t('maps.notation.format') }}</span><span v-else-if="row.label === 'required'" class="text-muted"> · {{ t('maps.notation.label') }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
