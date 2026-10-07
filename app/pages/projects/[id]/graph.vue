<script setup lang="ts">
/**
 * Старый адрес: «Граф» — вкладка экрана «Сверка» (docs/04-ui.md, «Навигация»). Закладки и
 * ссылки на него не ломаются, а ведут на вкладку.
 */
const route = useRoute();
await navigateTo({ path: `/projects/${String(route.params['id'] ?? '')}/verify`, query: { tab: 'graph' } }, { replace: true });
</script>

<template>
  <div />
</template>
