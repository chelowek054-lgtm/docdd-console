<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord, VerificationOutcome } from '~~/server/lib/types';

/**
 * Флажок «Проверено» на ручной проверке (docs/04-ui.md, «Отметка „Проверено“»).
 * Фиксируется отчётом в tests/reports и строкой в журнале; снятие — не провал,
 * а возврат в «не проверено». Флажок у проверки любого вида (ADR-0029); у автоматических видов приёмка
 * подписана «прогона сборки не было».
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

const actor = ref(props.roles[0]?.id ?? ''); const { me } = useMe(() => props.projectId);
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);

const checked = computed(() => props.result?.state === 'passed');

/** «проверено вручную · Архитектор · 2026-10-01»: ручной прогон не выдаёт себя за прогон сборки. */
const who = computed(() => {
  const result = props.result;
  if (!result || result.state !== 'passed') return '';
  const role = result.runner.startsWith('manual:') ? result.runner.slice('manual:'.length) : '';
  const name = props.roles.find((item) => item.id === role)?.name ?? role;
  // Ручная приёмка автоматического вида не выдаёт себя за прогон сборки.
  const head = !result.runner.startsWith('manual')
    ? `прогон ${result.runner}`
    : result.manualKind ? 'принята вручную, прогона сборки не было' : 'проверено вручную';
  return [head, name, result.checkedBy, result.at.slice(0, 10)].filter(Boolean).join(' · ');
});

const acceptOpen = ref(false);

async function toggle(value: boolean | 'indeterminate') {
  // Постановка отметки спрашивает, кто проверил и что (docs/04-ui.md, «Принять вручную»); снятие — как раньше.
  if (value === true) {
    acceptOpen.value = true;
    return;
  }
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
</script>

<template>
  <div class="text-sm">
    <div class="flex flex-wrap items-center gap-2">
      <UCheckbox
        :model-value="checked"
        :disabled="busy"
        label="Проверено"
        @update:model-value="toggle"
      />
      <USelect
        v-if="(!props.compact && props.roles.length) && !me.required"
        v-model="actor"
        size="xs"
        class="w-44"
        :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
      /><span v-if="me.required && me.user" class="text-sm text-muted">Вошли: {{ me.user.name }}</span>
      <span v-if="who" class="text-xs text-muted" :title="props.result?.note">{{ who }}</span>
    </div>


    <ManualAcceptModal
      v-model:open="acceptOpen"
      :project-id="props.projectId"
      :verification-ids="[props.record.id]"
      :roles="props.roles"
      @changed="emit('changed')"
    />

    <p v-if="failure" class="mt-1 text-xs text-error">{{ failure.message }}</p>
  </div>
</template>
