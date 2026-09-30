<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord, VerificationOutcome } from '~~/server/lib/types';

/**
 * Флажок «Проверено» на ручной проверке (docs/04-ui.md, «Отметка „Проверено“»).
 * Фиксируется отчётом в tests/reports и строкой в журнале; снятие — не провал,
 * а возврат в «не проверено». У автоматических проверок флажка нет: факт
 * приходит от сборки.
 */
const props = defineProps<{
  projectId: string;
  record: IndexRecord;
  result?: VerificationOutcome | undefined;
  roles: { id: string; name: string }[];
  /** В списке — короткая подпись; на экране записи — полная, с выбором роли. */
  compact?: boolean;
}>();

const emit = defineEmits<{ changed: [] }>();

const actor = ref(props.roles[0]?.id ?? '');
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);

const manual = computed(() => ['manual', 'review'].includes(String(props.record.extra['kind'] ?? '')));
const checked = computed(() => props.result?.state === 'passed');

/** «проверено вручную · Архитектор · 2026-10-01»: ручной прогон не выдаёт себя за прогон сборки. */
const who = computed(() => {
  const result = props.result;
  if (!result || result.state !== 'passed') return '';
  const role = result.runner.startsWith('manual:') ? result.runner.slice('manual:'.length) : '';
  const name = props.roles.find((item) => item.id === role)?.name ?? role;
  const head = result.runner.startsWith('manual') ? 'проверено вручную' : `прогон ${result.runner}`;
  return [head, name, result.at.slice(0, 10)].filter(Boolean).join(' · ');
});

async function toggle(value: boolean | 'indeterminate') {
  busy.value = true;
  failure.value = null;
  try {
    const response = await $fetch<unknown>(
      `/api/projects/${props.projectId}/records/${props.record.id}/verified`,
      { method: 'POST', body: { verified: value === true, actor: actor.value }, ignoreResponseError: true }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    emit('changed');
  } finally {
    busy.value = false;
  }
}

const REASON = 'факт приходит от сборки — положите отчёт в tests/reports';
</script>

<template>
  <div class="text-sm">
    <div v-if="manual" class="flex flex-wrap items-center gap-2">
      <UCheckbox
        :model-value="checked"
        :disabled="busy"
        label="Проверено"
        @update:model-value="toggle"
      />
      <USelect
        v-if="!props.compact && props.roles.length"
        v-model="actor"
        size="xs"
        class="w-44"
        :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
      />
      <span v-if="who" class="text-xs text-muted">{{ who }}</span>
    </div>

    <!-- Неактивный элемент без причины бесполезен (docs/04-ui.md). -->
    <p v-else-if="props.compact" class="text-xs text-muted" :title="REASON">от сборки</p>
    <p v-else class="text-muted">Флажка «Проверено» нет: {{ REASON }}.</p>

    <p v-if="failure" class="mt-1 text-xs text-error">{{ failure.message }}</p>
  </div>
</template>
