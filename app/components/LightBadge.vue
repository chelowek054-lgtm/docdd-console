<script setup lang="ts">
// Лёгкая метка для строк длинных списков: тот же вид, что у UBadge size="sm"
// (subtle/outline), но один <span> без обвязки компонента Nuxt UI — на сотнях
// строк разница видна во времени отрисовки. Классы записаны целиком, чтобы
// Tailwind их не выкинул при сборке.
const props = withDefaults(defineProps<{
  color?: string;
  variant?: 'subtle' | 'outline';
}>(), { color: 'neutral', variant: 'subtle' });

const SUBTLE: Record<string, string> = {
  primary: 'bg-primary/10 text-primary ring ring-inset ring-primary/25',
  secondary: 'bg-secondary/10 text-secondary ring ring-inset ring-secondary/25',
  success: 'bg-success/10 text-success ring ring-inset ring-success/25',
  info: 'bg-info/10 text-info ring ring-inset ring-info/25',
  warning: 'bg-warning/10 text-warning ring ring-inset ring-warning/25',
  error: 'bg-error/10 text-error ring ring-inset ring-error/25',
  neutral: 'ring ring-inset ring-accented text-default bg-elevated'
};
const OUTLINE: Record<string, string> = {
  primary: 'text-primary ring ring-inset ring-primary/50',
  secondary: 'text-secondary ring ring-inset ring-secondary/50',
  success: 'text-success ring ring-inset ring-success/50',
  info: 'text-info ring ring-inset ring-info/50',
  warning: 'text-warning ring ring-inset ring-warning/50',
  error: 'text-error ring ring-inset ring-error/50',
  neutral: 'text-default bg-default ring ring-inset ring-accented'
};
const tone = computed(() => (props.variant === 'outline' ? OUTLINE : SUBTLE)[props.color] ?? SUBTLE.neutral);
</script>

<template>
  <span class="rounded-md font-medium inline-flex items-center text-xs px-2 py-1 gap-1" :class="tone"><slot /></span>
</template>
