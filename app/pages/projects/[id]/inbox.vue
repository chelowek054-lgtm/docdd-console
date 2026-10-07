<script setup lang="ts">
/**
 * Старый адрес: «Входящее» — вкладка экрана «Наполнение» (docs/04-ui.md, «Навигация»). Закладки и
 * ссылки на него не ломаются, а ведут на вкладку.
 */
const route = useRoute();
await navigateTo({ path: `/projects/${String(route.params['id'] ?? '')}/fill`, query: { tab: 'inbox' } }, { replace: true });
</script>

<template>
  <div />
</template>
