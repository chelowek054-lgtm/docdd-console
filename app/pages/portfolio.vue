<script setup lang="ts">
// Портфель проектов (T-0042): какой проект идёт, какой стоит, где ошибки процесса.
import type { PortfolioRow } from '~~/server/lib/portfolio';

const { t } = useT();
const { data } = await useFetch<{ rows: PortfolioRow[] }>('/api/portfolio', { ignoreResponseError: true });
const rows = computed(() => data.value?.rows ?? []);
</script>

<template>
  <UContainer class="space-y-4 py-6">
    <h1 class="text-xl font-semibold">{{ t('pf.title') }}</h1>
    <p v-if="!rows.length" class="text-muted">{{ t('pf.none') }}</p>
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="text-left text-muted"><th>{{ t('pf.project') }}</th><th>{{ t('pf.phases') }}</th><th>{{ t('pf.tasks') }}</th><th>{{ t('pf.errors') }}</th><th>{{ t('pf.warnings') }}</th><th>{{ t('pf.activity') }}</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="border-t border-default">
          <td><NuxtLink :to="`/projects/${row.id}`" class="hover:underline">{{ row.name }}</NuxtLink></td>
          <template v-if="row.failure"><td colspan="5" class="text-error">{{ row.failure }}</td></template>
          <template v-else>
            <td>{{ row.phases.done }} {{ t('pf.of') }} {{ row.phases.total }}</td>
            <td>{{ row.tasks.done }} {{ t('pf.of') }} {{ row.tasks.total }}<span v-if="row.tasks.inProgress" class="text-muted"> · {{ t('pf.inWork') }} {{ row.tasks.inProgress }}</span></td>
            <td :class="row.errors ? 'text-error' : ''">{{ row.errors }}</td>
            <td>{{ row.warnings }}</td>
            <td>{{ row.lastActivity ?? '—' }}</td>
          </template>
        </tr>
      </tbody>
    </table>
  </UContainer>
</template>
