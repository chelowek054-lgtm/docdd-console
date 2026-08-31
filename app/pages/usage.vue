<script setup lang="ts">
// Текст берётся из документа репозитория: инструкция, которая живёт в двух
// местах, расходится на второй правке (docs/04-ui.md).
import usage from '~~/docs/08-usage.md?raw';

/** Front matter у этого документа нет — он не запись, а документация инструмента. */
const body = computed(() => usage);
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">Как пользоваться</h1>
      <p class="text-sm text-muted">
        Тот же текст лежит в репозитории: <code>docs/08-usage.md</code>
      </p>
    </div>

    <UCard>
      <DocumentText :body="body" />
    </UCard>
  </div>
</template>
