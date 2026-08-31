<script setup lang="ts">
const props = defineProps<{ source: string; id: string }>();

const container = ref<HTMLElement | null>(null);
const error = ref('');

/**
 * Отрисовка mermaid — только в браузере: библиотека меряет текст и без DOM не
 * работает. Ошибка разбора диаграммы — предупреждение у документа, а не отказ
 * его показать (docs/02-workspace-contract.md).
 */
async function draw() {
  if (!import.meta.client || !container.value) return;
  error.value = '';
  try {
    const mermaid = (await import('mermaid')).default;
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default'
    });
    const { svg } = await mermaid.render(`mermaid-${props.id}`, props.source);
    container.value.innerHTML = svg;
  } catch (cause) {
    container.value.innerHTML = '';
    error.value = cause instanceof Error ? cause.message.split('\n')[0] ?? '' : String(cause);
  }
}

onMounted(draw);
watch(() => props.source, draw);
</script>

<template>
  <div>
    <div ref="container" class="overflow-x-auto" />
    <UAlert
      v-if="error"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      title="Диаграмма не разобралась"
      :description="error"
    />
    <pre v-if="error" class="mt-2 overflow-x-auto rounded bg-elevated p-3 text-xs">{{ props.source }}</pre>
  </div>
</template>
