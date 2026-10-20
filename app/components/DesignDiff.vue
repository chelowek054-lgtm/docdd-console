<script setup lang="ts">
import type { DesignDiff } from '~~/server/lib/design-diff';

/**
 * Разница токенов дизайна (R-0073). Подключение: `<DesignDiff :diff="..." />`, где `diff` — ответ
 * `GET /api/projects/:id/design/record-diff?record=…`. Палитра «было / станет» рядом, контраст до
 * и после (упавший ниже порога выделен), файлы выгрузки по стекам с построчной разницей.
 */
defineProps<{ diff: DesignDiff }>();

const ratio = (value: number | null) => (value === null ? '—' : value.toFixed(2));
</script>

<template>
  <div class="space-y-4">
    <section v-for="theme in diff.palette" :key="theme.theme" class="ds-card space-y-1 p-3">
      <h4 class="text-sm font-medium">Палитра · {{ theme.theme }}</h4>
      <ul class="space-y-0.5 text-sm">
        <li v-for="row in theme.rows.filter((item) => item.state !== 'same')" :key="row.role" class="flex flex-wrap items-center gap-2">
          <span class="w-28 font-mono text-xs">{{ row.role }}</span>
          <span class="inline-block size-4 rounded border border-default" :style="{ background: row.before ?? 'transparent' }" />
          <span class="font-mono text-xs text-muted">{{ row.before ?? 'нет' }}</span>
          <span>→</span>
          <span class="inline-block size-4 rounded border border-default" :style="{ background: row.after ?? 'transparent' }" />
          <span class="font-mono text-xs">{{ row.after ?? 'убрана' }}</span>
        </li>
      </ul>
    </section>

    <section v-if="diff.contrast.length" class="ds-card space-y-1 p-3">
      <h4 class="text-sm font-medium">Контраст до и после</h4>
      <ul class="space-y-0.5 text-sm">
        <li v-for="row in diff.contrast" :key="`${row.theme}-${row.pair.join('/')}`" class="flex flex-wrap gap-2" :class="row.regressed ? 'text-error' : ''">
          <span class="w-20 text-xs text-muted">{{ row.theme }}</span>
          <span class="font-mono text-xs">{{ row.pair[0] }} на {{ row.pair[1] }}</span>
          <span class="font-mono text-xs">{{ ratio(row.before) }} → {{ ratio(row.after) }} (нужно {{ row.min }})</span>
          <span v-if="row.regressed" class="text-xs">ниже порога</span>
        </li>
      </ul>
    </section>

    <section v-if="diff.stacks.length" class="ds-card space-y-2 p-3">
      <h4 class="text-sm font-medium">Файлы выгрузки, которые поменяются</h4>
      <div v-for="stack in diff.stacks" :key="stack.id">
        <p class="text-sm">{{ stack.label }}</p>
        <details v-for="file in stack.files" :key="file.key" class="ml-3 text-xs">
          <summary class="cursor-pointer font-mono">{{ file.defaultPath }} · {{ file.state === 'added' ? 'новый' : 'изменится' }}</summary>
          <pre class="overflow-x-auto whitespace-pre-wrap">{{ file.diff }}</pre>
        </details>
      </div>
    </section>

    <p v-if="!diff.palette.length && !diff.stacks.length" class="text-sm text-muted">Палитра и выгрузка не меняются.</p>
  </div>
</template>
