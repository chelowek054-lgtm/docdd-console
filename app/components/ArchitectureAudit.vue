<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { AUDIT_KIND_LABEL, type AuditResult } from '../../server/lib/architecture';

/**
 * Ответ «Аудита архитектуры» таблицей: путь, вид, что не так (docs/04-ui.md,
 * «Архитектура на карте кода»). Мнение модели, а не свидетельство: ничего не
 * пишется, а в задачи находки превращает человек.
 */
const props = defineProps<{
  projectId: string;
  answer: string;
}>();

const result = ref<AuditResult | null>(null);
const failure = ref<ApiFailure | null>(null);
const loading = ref(false);

async function parse() {
  loading.value = true;
  failure.value = null;
  result.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/architecture`, {
      method: 'POST',
      body: { answer: props.answer },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    result.value = response as AuditResult;
  } finally {
    loading.value = false;
  }
}

watch(() => props.answer, parse, { immediate: true });
</script>

<template>
  <div class="mb-3">
    <p v-if="loading" class="text-sm text-muted">Разбираю ответ…</p>

    <!-- Блока нет — это не отказ: ответ остаётся текстом ниже, как раньше. -->
    <p v-else-if="failure" class="text-sm text-muted">{{ failure.message }}</p>

    <template v-else-if="result">
      <p v-if="result.findings.length === 0" class="text-sm text-muted">
        Модель ничего не нашла сверх точной проверки.
      </p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-left text-sm">
          <thead class="text-xs text-muted">
            <tr><th class="pr-3">Путь</th><th class="pr-3">Вид</th><th>Что не так</th></tr>
          </thead>
          <tbody>
            <tr v-for="row in result.findings" :key="`${row.path}|${row.kind}`" class="border-t border-default align-top">
              <td class="py-1 pr-3 font-mono text-xs">{{ row.path }}</td>
              <td class="py-1 pr-3"><UBadge color="neutral" variant="subtle">{{ AUDIT_KIND_LABEL[row.kind] }}</UBadge></td>
              <td class="py-1">{{ row.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <ul v-if="result.skipped.length" class="mt-2 space-y-0.5 text-xs text-muted">
        <li v-for="(item, at) in result.skipped" :key="at">Пропущено `{{ item.path }}`: {{ item.reason }}</li>
      </ul>
    </template>
  </div>
</template>
