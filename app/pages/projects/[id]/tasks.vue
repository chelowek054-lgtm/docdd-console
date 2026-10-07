<script setup lang="ts">
/**
 * Старый адрес: «Задачи» — вкладка экрана «Работа» (docs/04-ui.md). Закладки и
 * ссылки на него не ломаются, а ведут на вкладку.
 */
const route = useRoute();
await navigateTo({ path: `/projects/${String(route.params['id'] ?? '')}/work`, query: { tab: 'tasks' } }, { replace: true });
</script>

<template>
  <div />
</template>
