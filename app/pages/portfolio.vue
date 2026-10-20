<script setup lang="ts">
// Портфель проектов (T-0042): какой проект идёт, какой стоит, где ошибки процесса.
import type { PortfolioRow } from '~~/server/lib/portfolio';

const { data } = await useFetch<{ rows: PortfolioRow[] }>('/api/portfolio', { ignoreResponseError: true });
const rows = computed(() => data.value?.rows ?? []);
</script>

<template>
  <UContainer class="space-y-4 py-6">
    <h1 class="text-xl font-semibold">Портфель проектов</h1>
    <p v-if="!rows.length" class="text-muted">Проектов в списке нет.</p>
    <table v-else class="w-full text-sm">
      <thead>
        <tr class="text-left text-muted"><th>Проект</th><th>Фазы</th><th>Задачи</th><th>Ошибки</th><th>Предупреждения</th><th>Активность</th></tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.id" class="border-t border-default">
          <td><NuxtLink :to="`/projects/${row.id}`" class="hover:underline">{{ row.name }}</NuxtLink></td>
          <template v-if="row.failure"><td colspan="5" class="text-error">{{ row.failure }}</td></template>
          <template v-else>
            <td>{{ row.phases.done }} из {{ row.phases.total }}</td>
            <td>{{ row.tasks.done }} из {{ row.tasks.total }}<span v-if="row.tasks.inProgress" class="text-muted"> · в работе {{ row.tasks.inProgress }}</span></td>
            <td :class="row.errors ? 'text-error' : ''">{{ row.errors }}</td>
            <td>{{ row.warnings }}</td>
            <td>{{ row.lastActivity ?? '—' }}</td>
          </template>
        </tr>
      </tbody>
    </table>
  </UContainer>
</template>
