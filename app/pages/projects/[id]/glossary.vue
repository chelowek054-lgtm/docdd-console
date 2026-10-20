<script setup lang="ts">
import type { GlossaryTerm } from '~~/server/lib/glossary';

/** Термины проекта (T-0041). Файл правят руками; термины из текста запроса сами попадают в пакет контекста. */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { data } = useFetch<{ terms: GlossaryTerm[] }>(() => `/api/projects/${projectId.value}/glossary`, { key: () => `glossary:${projectId.value}`, default: () => ({ terms: [] }) });
</script>

<template>
  <div class="space-y-3">
    <h1 class="text-xl font-semibold">Глоссарий</h1>
    <dl class="space-y-2 text-sm">
      <div v-for="entry in data.terms" :key="entry.term">
        <dt class="font-medium">{{ entry.term }}</dt>
        <dd class="text-muted">{{ entry.definition }}</dd>
      </div>
    </dl>
    <p v-if="data.terms.length === 0" class="text-sm text-muted">Терминов нет. Заведите файл <span class="font-mono">docs/development/glossary.md</span> со строками «- **Термин** — определение».</p>
  </div>
</template>
