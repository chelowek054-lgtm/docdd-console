<script setup lang="ts">
import type { DesignDiff } from '~~/server/lib/design-diff';

/**
 * Разница токенов дизайна (R-0073). Подключение: `<DesignDiff :diff="..." />`, где `diff` — ответ
 * `GET /api/projects/:id/design/record-diff?record=…`. Палитра «было / станет» рядом, контраст до
 * и после (упавший ниже порога выделен), файлы выгрузки по стекам с построчной разницей.
 */
defineProps<{ diff: DesignDiff }>();

const ratio = (value: number | null) => (value === null ? '—' : value.toFixed(2)); const { t } = useT();
</script>

<template>
  <div class="space-y-4">
    <section v-for="theme in diff.palette" :key="theme.theme" class="ds-card space-y-1 p-3">
      <h4 class="text-sm font-medium">{{ t('dd.palette') }} · {{ theme.theme }}</h4>
      <ul class="space-y-0.5 text-sm">
        <li v-for="row in theme.rows.filter((item) => item.state !== 'same')" :key="row.role" class="flex flex-wrap items-center gap-2">
          <span class="w-28 font-mono text-xs">{{ row.role }}</span>
          <span class="inline-block size-4 rounded border border-default" :style="{ background: row.before ?? 'transparent' }" />
          <span class="font-mono text-xs text-muted">{{ row.before ?? t('dd.none') }}</span>
          <span>→</span>
          <span class="inline-block size-4 rounded border border-default" :style="{ background: row.after ?? 'transparent' }" />
          <span class="font-mono text-xs">{{ row.after ?? t('dd.removed') }}</span>
        </li>
      </ul>
    </section>

    <section v-if="diff.contrast.length" class="ds-card space-y-1 p-3">
      <h4 class="text-sm font-medium">{{ t('dd.contrast') }}</h4>
      <ul class="space-y-0.5 text-sm">
        <li v-for="row in diff.contrast" :key="`${row.theme}-${row.pair.join('/')}`" class="flex flex-wrap gap-2" :class="row.regressed ? 'text-error' : ''">
          <span class="w-20 text-xs text-muted">{{ row.theme }}</span>
          <span class="font-mono text-xs">{{ row.pair[0] }} {{ t('dd.on') }} {{ row.pair[1] }}</span>
          <span class="font-mono text-xs">{{ ratio(row.before) }} → {{ ratio(row.after) }} ({{ t('dd.need') }} {{ row.min }})</span>
          <span v-if="row.regressed" class="text-xs">{{ t('dd.below') }}</span>
        </li>
      </ul>
    </section>

    <section v-if="diff.stacks.length" class="ds-card space-y-2 p-3">
      <h4 class="text-sm font-medium">{{ t('dd.files') }}</h4>
      <div v-for="stack in diff.stacks" :key="stack.id">
        <p class="text-sm">{{ stack.label }}</p>
        <details v-for="file in stack.files" :key="file.key" class="ml-3 text-xs">
          <summary class="cursor-pointer font-mono">{{ file.defaultPath }} · {{ file.state === 'added' ? t('dd.new') : t('dd.changes') }}</summary>
          <pre class="overflow-x-auto whitespace-pre-wrap">{{ file.diff }}</pre>
        </details>
      </div>
    </section>

    <p v-if="!diff.palette.length && !diff.stacks.length" class="text-sm text-muted">{{ t('dd.same') }}</p>
  </div>
</template>
