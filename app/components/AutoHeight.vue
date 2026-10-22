<script setup lang="ts">
/**
 * Плавная смена высоты: окно с разным содержимым (разделы настроек) не прыгает,
 * а растёт и сжимается. Высоту меряет ResizeObserver у содержимого.
 */
const inner = ref<HTMLElement | null>(null);
const height = ref<string>('auto');
let observer: ResizeObserver | undefined;

onMounted(() => {
  if (!inner.value) return;
  observer = new ResizeObserver(([entry]) => { if (entry) height.value = `${entry.contentRect.height}px`; });
  observer.observe(inner.value);
});
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div class="overflow-hidden transition-[height] duration-(--ds-motion-base) ease-out" :style="{ height }">
    <div ref="inner">
      <slot />
    </div>
  </div>
</template>
