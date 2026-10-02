<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { RELATION_LABEL, type RelationItem, type RelationsResult } from '../../server/lib/functional';

/**
 * Ответ «Предложить связи» таблицей: от — вид — к — фраза (docs/04-ui.md,
 * «Функциональная карта»). Это мнение, а не свидетельство: «Занести связи»
 * кладёт отмеченное в пачку связей на экране — не в карту. Уже стоящие связи в
 * таблицу не попадают, а считаются в «пропущено».
 */
const props = defineProps<{
  projectId: string;
  answer: string;
  /** id → название возможности: на экране читают названия, а не идентификаторы. */
  titles: Record<string, string>;
}>();

const emit = defineEmits<{
  apply: [relations: RelationItem[]];
}>();

const result = ref<RelationsResult | null>(null);
const failure = ref<ApiFailure | null>(null);
const loading = ref(false);
const picked = ref<Set<string>>(new Set());
const applied = ref(false);

const keyOf = (relation: { from: string; to: string; type: string }) => `${relation.from}>${relation.to}:${relation.type}`;
const nameOf = (id: string) => props.titles[id] ?? id;

async function parse() {
  loading.value = true;
  failure.value = null;
  result.value = null;
  applied.value = false;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/map/functional-relations`, {
      method: 'POST',
      body: { answer: props.answer },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    const parsed = response as RelationsResult;
    result.value = parsed;
    picked.value = new Set(parsed.relations.map(keyOf));
  } finally {
    loading.value = false;
  }
}

watch(() => props.answer, parse, { immediate: true });

function toggle(key: string, value: boolean | 'indeterminate') {
  const next = new Set(picked.value);
  if (value === true) next.add(key);
  else next.delete(key);
  picked.value = next;
}

function apply() {
  const rows = (result.value?.relations ?? []).filter((relation) => picked.value.has(keyOf(relation)));
  if (rows.length === 0) return;
  emit('apply', rows);
  applied.value = true;
}
</script>

<template>
  <div class="mb-3">
    <p v-if="loading" class="text-sm text-muted">Разбираю ответ…</p>

    <!-- Блока нет — это не отказ: ответ остаётся текстом ниже, как раньше. -->
    <p v-else-if="failure" class="text-sm text-muted">{{ failure.message }}</p>

    <template v-else-if="result">
      <p v-if="result.relations.length === 0" class="text-sm text-muted">
        Новых связей в ответе нет.
      </p>

      <template v-else>
        <div class="overflow-x-auto rounded border border-default">
          <table class="w-full text-sm">
            <thead class="bg-elevated text-left text-xs text-muted">
              <tr>
                <th class="w-8 p-2" />
                <th class="p-2">От</th>
                <th class="p-2">Вид</th>
                <th class="p-2">К</th>
                <th class="p-2">Чем связаны</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in result.relations" :key="keyOf(row)" class="border-t border-default align-top">
                <td class="p-2">
                  <UCheckbox
                    :model-value="picked.has(keyOf(row))"
                    :aria-label="`Занести связь: ${nameOf(row.from)} — ${nameOf(row.to)}`"
                    @update:model-value="(value) => toggle(keyOf(row), value)"
                  />
                </td>
                <td class="p-2">{{ nameOf(row.from) }}</td>
                <td class="p-2">
                  <UBadge size="xs" variant="subtle" color="neutral">{{ RELATION_LABEL[row.type] }}</UBadge>
                </td>
                <td class="p-2">{{ nameOf(row.to) }}</td>
                <td class="p-2 text-xs text-muted">{{ row.summary }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mt-2 flex flex-wrap items-center gap-3">
          <UButton size="sm" :disabled="picked.size === 0" @click="apply">
            Занести связи ({{ picked.size }})
          </UButton>
          <p class="text-xs text-muted">
            Они попадут в пачку связей на экране, а не в карту: проверьте и сохраните.
          </p>
          <p v-if="applied" class="text-sm text-success">Занесено — смотрите дерево.</p>
        </div>
      </template>

      <ul v-if="result.skipped.length" class="mt-2 space-y-0.5 text-xs text-muted">
        <li v-for="row in result.skipped" :key="`${row.from}>${row.to}:${row.type}`">
          <span class="font-mono">{{ row.from }} → {{ row.to }}</span> ({{ row.type }}) — пропущено: {{ row.reason }}
        </li>
      </ul>
    </template>
  </div>
</template>
