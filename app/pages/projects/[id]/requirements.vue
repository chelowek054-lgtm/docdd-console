<script setup lang="ts">
/**
 * Старый адрес: «Требования» — вкладка списка документов (docs/04-ui.md, «Требования»).
 * Закладки и ссылки на него не ломаются, а ведут на вкладку.
 */
const route = useRoute();
await navigateTo({ path: `/projects/${String(route.params['id'] ?? '')}/documents`, query: { type: 'requirement' } }, { replace: true });
</script>

<template>
  <div />
</template>
