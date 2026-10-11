<script setup lang="ts">
import { COMPONENT_NAMES, type DesignTokens } from '~~/server/lib/design';

/**
 * Реестр обязательных компонентов (docs/16-design-system.md): что объявлено,
 * откуда и найдено ли в коде проекта. «Найден в коде» приходит, когда проект
 * объявил исходники (`sources.code`) и карта кода их описывает; иначе — «не
 * сверялось», а не «нет».
 */
const props = defineProps<{
  tokens: DesignTokens;
  /** Имена компонентов, которых нет в коде; `null` — сверять не с чем. */
  missing: string[] | null;
}>();

const rows = computed(() => {
  const declared = props.tokens.components.map((item) => ({
    name: item.value.name,
    summary: item.value.summary ?? '',
    source: item.source,
    required: (COMPONENT_NAMES as readonly string[]).includes(item.value.name)
  }));
  const absent = COMPONENT_NAMES.filter((name) => !declared.some((row) => row.name === name))
    .map((name) => ({ name: name as string, summary: '', source: '', required: true }));
  return [...declared, ...absent];
});

function state(name: string, source: string): { label: string; color: 'success' | 'error' | 'neutral' | 'warning' } {
  if (!source) return { label: 'не объявлен', color: 'warning' };
  if (props.missing === null) return { label: 'не сверялось', color: 'neutral' };
  return props.missing.includes(name) ? { label: 'нет в коде', color: 'error' } : { label: 'есть в коде', color: 'success' };
}
</script>

<template>
  <div class="space-y-3">
    <h2 class="font-medium">Реестр компонентов</h2>
    <p v-if="missing === null" class="text-sm text-muted">
      Компоненты проекта не сверялись: нет описанных исходников (<code>sources.code</code> в манифесте и карта кода).
    </p>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[30rem] text-left text-sm">
        <thead class="text-xs text-muted">
          <tr><th class="pr-3">Компонент</th><th class="pr-3">Состояние</th><th class="pr-3">Что делает</th><th>Источник</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.name" class="border-t border-default align-top">
            <td class="py-1.5 pr-3 font-mono text-xs">{{ row.name }}</td>
            <td class="py-1.5 pr-3">
              <UBadge :color="state(row.name, row.source).color" variant="subtle" size="sm">{{ state(row.name, row.source).label }}</UBadge>
            </td>
            <td class="py-1.5 pr-3">{{ row.summary || '—' }}</td>
            <td class="py-1.5 text-xs text-muted">{{ row.source || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
