<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { STATE_LABEL, type CapabilityStatus } from '~~/server/lib/functional';
import type { CheckProposal } from '~~/server/lib/functional-check';

/**
 * Ответ «Проверить по коду» как таблица «сейчас → по мнению модели»
 * (docs/04-ui.md, «Функциональная карта»). Разбор — на сервере, ничего не
 * пишется: «Занести отметки» лишь передаёт выбранные строки в несохранённые
 * отметки дерева, а черновик карты появится только по «Сохранить отметки».
 */
const props = defineProps<{
  projectId: string;
  answer: string;
}>();

const emit = defineEmits<{
  apply: [marks: { id: string; status: CapabilityStatus; note?: string }[]];
}>();

const proposals = ref<CheckProposal[]>([]);
const problems = ref<string[]>([]);
const failure = ref<ApiFailure | null>(null);
const loading = ref(false);
const picked = ref<Set<string>>(new Set());

/** Строка, где мнение совпало с отметкой, ничего не меняет — приглушена и по умолчанию не отмечена. */
function same(proposal: CheckProposal): boolean {
  return proposal.current === proposal.proposed;
}

async function parse() {
  loading.value = true;
  failure.value = null;
  proposals.value = [];
  problems.value = [];
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
    const parsed = response as { proposals: CheckProposal[]; problems: string[] };
    proposals.value = parsed.proposals;
    problems.value = parsed.problems;
    picked.value = new Set(parsed.proposals.filter((item) => !same(item)).map((item) => item.id));
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
  emit('apply', proposals.value
    .filter((item) => picked.value.has(item.id))
    .map((item) => ({ id: item.id, status: item.proposed, note: item.note })));
}

function label(status: CapabilityStatus | null): string {
  return STATE_LABEL[status ?? 'unassessed'];
}
</script>

<template>
  <div class="mb-3 space-y-3">
    <p v-if="loading" class="text-sm text-muted">Разбираю ответ…</p>

    <!-- Нет блока — значит, разбирать нечего: ответ остаётся текстом ниже, ничего не теряется. -->
    <UAlert
      v-else-if="failure"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      description="Ответ модели ниже остаётся текстом: прочитайте его и расставьте отметки руками."
    />

    <template v-else>
      <p v-if="proposals.length === 0" class="text-sm text-muted">
        Модель не предложила ни одной отметки — каждую возможность она пропустила как неочевидную.
      </p>

      <div v-else class="overflow-x-auto rounded border border-default">
        <table class="w-full text-sm">
          <thead class="bg-elevated text-left text-xs text-muted">
            <tr>
              <th class="w-8 p-2" />
              <th class="p-2">Возможность</th>
              <th class="p-2">Сейчас</th>
              <th class="p-2">По мнению модели</th>
              <th class="p-2">Что сделано и чего не хватает</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="item in proposals"
              :key="item.id"
              class="border-t border-default"
              :class="same(item) ? 'text-muted' : ''"
            >
              <td class="p-2">
                <UCheckbox
                  :model-value="picked.has(item.id)"
                  :aria-label="`Занести отметку: ${item.title ?? item.id}`"
                  @update:model-value="(value) => toggle(item.id, value)"
                />
              </td>
              <td class="p-2">{{ item.title ?? item.id }}</td>
              <td class="p-2">
                <UBadge
                  :color="STATE_UI[item.current ?? 'unassessed'].color"
                  variant="subtle"
                  size="sm"
                  :icon="STATE_UI[item.current ?? 'unassessed'].icon"
                >{{ label(item.current) }}</UBadge>
              </td>
              <td class="p-2">
                <UBadge
                  :color="STATE_UI[item.proposed].color"
                  variant="subtle"
                  size="sm"
                  :icon="STATE_UI[item.proposed].icon"
                >{{ label(item.proposed) }}</UBadge>
              </td>
              <td class="p-2">{{ item.note }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="proposals.length" class="flex flex-wrap items-center gap-3">
        <UButton size="sm" :disabled="picked.size === 0" @click="apply">
          Занести отметки: {{ picked.size }}
        </UButton>
        <p class="text-sm text-muted">
          Отметки лягут на дерево несохранёнными — сохраните их кнопкой над деревом.
        </p>
      </div>

      <ul v-if="problems.length" class="space-y-0.5 text-sm text-muted">
        <li v-for="problem in problems" :key="problem">· {{ problem }}</li>
      </ul>
    </template>
  </div>
</template>
