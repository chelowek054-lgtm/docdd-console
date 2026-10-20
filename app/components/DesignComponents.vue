<script setup lang="ts">
import { COMPONENT_NAMES, type DesignTokens } from '~~/server/lib/design';
import type { ContractProp } from '~~/server/lib/design-contract';
import type { CatalogReport } from '~~/server/lib/design-catalog';

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
  /** Без проекта (глобальный экран) матрицу историй не читаем. */
  projectId?: string;
}>();

const { t } = useT();

// Матрица историй: `null` — каталоги в манифесте не объявлены.
const { data: catalogData } = useFetch<{ report: CatalogReport | null } | { error: unknown }>(
  () => (props.projectId ? `/api/projects/${props.projectId}/design/catalog` : ''),
  { key: () => `design-catalog:${props.projectId ?? ''}`, immediate: Boolean(props.projectId) }
);
const catalog = computed(() => {
  const value = catalogData.value;
  return value && 'report' in value ? value.report : null;
});

const rows = computed(() => {
  const declared = props.tokens.components.map((item) => ({
    name: item.value.name,
    summary: item.value.summary ?? '',
    states: item.value.states ?? [],
    parts: item.value.parts ?? [],
    lifecycle: item.value.status ?? 'stable',
    source: item.source,
    kind: item.value.kind ?? null,
    composedOf: item.value.composedOf ?? [],
    variants: item.value.variants ?? [],
    props: item.value.props ?? [],
    slots: item.value.slots ?? [],
    events: item.value.events ?? [],
    logic: item.value.logic ?? ''
  }));
  const absent = COMPONENT_NAMES.filter((name) => !declared.some((row) => row.name === name))
    .map((name) => ({ name: name as string, summary: '', states: [] as string[], parts: [] as string[], lifecycle: 'draft', source: '', kind: null, composedOf: [] as string[], variants: [] as string[], props: [] as ContractProp[], slots: [] as string[], events: [] as string[], logic: '' }));
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
          <template v-for="row in rows" :key="row.name">
          <tr class="border-t border-default align-top">
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
          <tr v-if="row.kind || row.variants.length || row.props.length || row.slots.length || row.events.length || row.logic" class="align-top">
            <td colspan="7" class="pb-2 pr-3 text-xs text-muted">
              <span v-if="row.kind" class="mr-3">{{ t(`dc.kind.${row.kind}`) }}<template v-if="row.composedOf.length"> · {{ t('dc.contract.composed') }}: {{ row.composedOf.join(', ') }}</template></span>
              <span v-if="row.variants.length" class="mr-3">{{ t('dc.contract.variants') }}: {{ row.variants.join(', ') }}</span>
              <span v-if="row.props.length" class="mr-3">{{ t('dc.contract.props') }}: {{ row.props.map((prop) => `${prop.name}: ${prop.type}${prop.default !== undefined ? ` = ${prop.default}` : ''}`).join('; ') }}</span>
              <span v-if="row.slots.length" class="mr-3">{{ t('dc.contract.slots') }}: {{ row.slots.join(', ') }}</span>
              <span v-if="row.events.length" class="mr-3">{{ t('dc.contract.events') }}: {{ row.events.join(', ') }}</span>
              <span v-if="row.logic" class="text-warning">{{ t('dc.contract.logic') }}: {{ row.logic }}</span>
            </td>
          </tr>
          </template>
        </tbody>
      </table>
    </div>
    <div v-if="catalog" class="space-y-2">
      <h3 class="font-medium">{{ t('dc.matrix.title') }}</h3>
      <p class="text-sm text-muted">{{ t('dc.matrix.lead') }}</p>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[32rem] text-left text-sm">
          <thead class="text-xs text-muted">
            <tr>
              <th class="pr-3">{{ t('dc.col.name') }}</th>
              <th class="pr-3">{{ t('dc.matrix.item') }}</th>
              <th v-for="column in catalog.columns" :key="column.stack" class="pr-3">
                {{ column.label }}
                <span v-if="column.state !== 'ok'" class="text-warning">({{ t(`dc.matrix.state.${column.state}`) }})</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="row in catalog.rows" :key="`${row.component}:${row.item}`" class="border-t border-default">
              <td class="py-1 pr-3 font-mono text-xs">{{ row.component }}</td>
              <td class="py-1 pr-3 text-xs">{{ row.item }}</td>
              <td v-for="cell in row.cells" :key="cell.stack" class="py-1 pr-3 text-xs" :class="cell.stories.length ? '' : 'text-error'">
                {{ cell.stories.length ? cell.stories.length : t('dc.matrix.gap') }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul v-if="catalog.findings.length" class="list-disc pl-5 text-xs text-muted">
        <li v-for="(finding, at) in catalog.findings" :key="at"><code>{{ finding.code }}</code> · {{ finding.message }}</li>
      </ul>
    </div>
  </div>
</template>
