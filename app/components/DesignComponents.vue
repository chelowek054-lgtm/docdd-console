<script setup lang="ts">
import { COMPONENT_NAMES, type DesignTokens } from '~~/server/lib/design';

/**
 * Реестр обязательных компонентов (docs/16-design-system.md): что объявлено,
 * откуда, какие состояния и слои у него есть, на каком он этапе жизни и найден
 * ли в коде проекта. «Найден в коде» приходит, когда проект объявил исходники
 * (`sources.code`) и карта кода их описывает; иначе — «не сверялось», а не «нет».
 */
const props = defineProps<{
  tokens: DesignTokens;
  /** Имена компонентов, которых нет в коде; `null` — сверять не с чем. */
  missing: string[] | null;
}>();

const { t } = useT();

const rows = computed(() => {
  const declared = props.tokens.components.map((item) => ({
    name: item.value.name,
    summary: item.value.summary ?? '',
    states: item.value.states ?? [],
    parts: item.value.parts ?? [],
    lifecycle: item.value.status ?? 'stable',
    source: item.source
  }));
  const absent = COMPONENT_NAMES.filter((name) => !declared.some((row) => row.name === name))
    .map((name) => ({ name: name as string, summary: '', states: [] as string[], parts: [] as string[], lifecycle: 'draft', source: '' }));
  return [...declared, ...absent];
});

function state(name: string, source: string): { label: string; color: 'success' | 'error' | 'neutral' | 'warning' } {
  if (!source) return { label: t('dc.state.undeclared'), color: 'warning' };
  if (props.missing === null) return { label: t('dc.state.unchecked'), color: 'neutral' };
  return props.missing.includes(name)
    ? { label: t('dc.state.missing'), color: 'error' }
    : { label: t('dc.state.present'), color: 'success' };
}
</script>

<template>
  <div class="space-y-3">
    <h2 class="font-medium">{{ t('dc.title') }}</h2>
    <p v-if="missing === null" class="text-sm text-muted">{{ t('dc.notChecked') }}</p>
    <div class="overflow-x-auto">
      <table class="w-full min-w-[44rem] text-left text-sm">
        <thead class="text-xs text-muted">
          <tr>
            <th class="pr-3">{{ t('dc.col.name') }}</th>
            <th class="pr-3">{{ t('dc.col.code') }}</th>
            <th class="pr-3">{{ t('dc.col.what') }}</th>
            <th class="pr-3">{{ t('dc.col.states') }}</th>
            <th class="pr-3">{{ t('dc.col.parts') }}</th>
            <th class="pr-3">{{ t('dc.col.cycle') }}</th>
            <th>{{ t('dt.col.source') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.name" class="border-t border-default align-top">
            <td class="py-1.5 pr-3 font-mono text-xs">{{ row.name }}</td>
            <td class="py-1.5 pr-3">
              <UBadge :color="state(row.name, row.source).color" variant="subtle" size="sm">{{ state(row.name, row.source).label }}</UBadge>
            </td>
            <td class="py-1.5 pr-3">{{ row.summary || '—' }}</td>
            <td class="py-1.5 pr-3 text-xs">{{ row.states.join(', ') || '—' }}</td>
            <td class="py-1.5 pr-3 text-xs">{{ row.parts.join(', ') || '—' }}</td>
            <td class="py-1.5 pr-3 text-xs" :class="row.lifecycle === 'deprecated' ? 'text-warning' : ''">{{ row.lifecycle }}</td>
            <td class="py-1.5 text-xs text-muted">{{ row.source || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
