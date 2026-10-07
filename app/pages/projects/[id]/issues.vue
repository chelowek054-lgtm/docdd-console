<script setup lang="ts">
/**
 * Старый адрес: «Нарушения» — вкладка экрана «Сверка» (docs/04-ui.md, «Навигация»). Закладки и
 * ссылки на него не ломаются, а ведут на вкладку.
 */
const route = useRoute();
await navigateTo({ path: `/projects/${String(route.params['id'] ?? '')}/verify`, query: { tab: 'issues' } }, { replace: true });
</script>

<template>
  <div />
</template>
