<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { IMPL_LABEL, type FunctionalCheckResult, type ImplStatus } from '../../server/lib/functional';

/**
 * Ответ «Проверить по коду» таблицей: возможность, что в карте сейчас, что
 * думает модель, её `note` (docs/04-ui.md, «Функциональная карта»). Это
 * мнение, а не свидетельство: «Занести отметки» кладёт выбранное в
 * несохранённые отметки дерева — не в карту. Дальше человек правит и
 * сохраняет.
 */
const props = defineProps<{
  projectId: string;
  answer: string;
}>();

const emit = defineEmits<{
  apply: [rows: { id: string; status: ImplStatus; note: string }[]];
}>();

const result = ref<FunctionalCheckResult | null>(null);
const failure = ref<ApiFailure | null>(null);
const loading = ref(false);
const picked = ref<Set<string>>(new Set());
const applied = ref(false);

async function parse() {
  loading.value = true;
  failure.value = null;
  result.value = null;
  applied.value = false;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/map/functional-check`, {
      method: 'POST',
      body: { answer: props.answer },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const parsed = response as FunctionalCheckResult;
    result.value = parsed;
    // Совпавшее с картой выбирать незачем: занести там нечего.
    picked.value = new Set(parsed.checks.filter((row) => row.current !== row.proposed).map((row) => row.id));
  } finally {
    loading.value = false;
  }
}

watch(() => props.answer, parse, { immediate: true });

function toggle(id: string, value: boolean | 'indeterminate') {
  const next = new Set(picked.value);
  if (value === true) next.add(id);
  else next.delete(id);
  picked.value = next;
}

function apply() {
  const rows = (result.value?.checks ?? [])
    .filter((row) => picked.value.has(row.id))
    .map((row) => ({ id: row.id, status: row.proposed, note: row.note }));
  if (rows.length === 0) return;
  emit('apply', rows);
  applied.value = true;
}

const BADGE_COLOR = { implemented: 'success', partial: 'warning', not_implemented: 'error', unrated: 'neutral' } as const;
</script>

<template>
  <div class="mb-3">
    <p v-if="loading" class="text-sm text-muted">Разбираю ответ…</p>

    <!-- Блока нет — это не отказ: ответ остаётся текстом ниже, как раньше. -->
    <p v-else-if="failure" class="text-sm text-muted">{{ failure.message }}</p>

    <template v-else-if="result">
      <p v-if="result.checks.length === 0" class="text-sm text-muted">
        Предложений по состоянию в ответе нет.
      </p>

      <template v-else>
        <div class="overflow-x-auto rounded border border-default">
          <table class="w-full text-sm">
            <thead class="bg-elevated text-left text-xs text-muted">
              <tr>
                <th class="w-8 p-2" />
                <th class="p-2">Возможность</th>
                <th class="p-2">Сейчас</th>
                <th class="p-2">По мнению модели</th>
                <th class="p-2">Что нашла</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in result.checks" :key="row.id" class="border-t border-default align-top">
                <td class="p-2">
                  <UCheckbox
                    :model-value="picked.has(row.id)"
                    :aria-label="`Занести отметку: ${row.title}`"
                    @update:model-value="(value) => toggle(row.id, value)"
                  />
                </td>
                <td class="p-2">{{ row.title }}</td>
                <td class="p-2">
                  <UBadge size="xs" variant="subtle" :color="BADGE_COLOR[row.current ?? 'unrated']">
                    {{ IMPL_LABEL[row.current ?? 'unrated'] }}
                  </UBadge>
                </td>
                <td class="p-2">
                  <UBadge size="xs" variant="subtle" :color="BADGE_COLOR[row.proposed]">
                    {{ IMPL_LABEL[row.proposed] }}
                  </UBadge>
                </td>
                <td class="p-2 text-xs text-muted">{{ row.note }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-3">
          <UButton size="sm" :disabled="picked.size === 0" @click="apply">
            Занести отметки ({{ picked.size }})
          </UButton>
          <p class="text-xs text-muted">
            Они попадут в несохранённые отметки дерева, а не в карту: проверьте и сохраните.
          </p>
          <p v-if="applied" class="text-sm text-success">Занесено — смотрите дерево.</p>
        </div>
      </template>

      <ul v-if="result.skipped.length" class="mt-2 space-y-0.5 text-xs text-muted">
        <li v-for="row in result.skipped" :key="row.id">
          <span class="font-mono">{{ row.id }}</span> — пропущено: {{ row.reason }}
        </li>
      </ul>
    </template>
  </div>
</template>
