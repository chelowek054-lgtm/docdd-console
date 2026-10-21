<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { FixState } from '~~/server/utils/fix-service';

/**
 * Починка нарушений по подтверждённому плану
 * (docs/adr/0010-model-fixes-violations.md). «Принять ответ» — это и есть
 * подтверждение: до него не заводится ни ветка, ни правка. Дальше приложение
 * показывает дифф и ничего не сливает само.
 */
const props = defineProps<{
  projectId: string;
  /** План, который человек читает: ответ модели на «Исправить». */
  plan: string;
  /** Отмеченные нарушения: по ним считается граница починки. */
  issues: { code: string; path?: string | null; recordId?: string | null }[];
  roles: { id: string; name: string }[];
}>();

const emit = defineEmits<{ changed: [] }>(); const { t } = useT();

const { running, elapsed, outcome, log, stream, cancel } = useModelRequest(() => `${props.projectId}:fix`, {
  label: t('fx.label'),
  onRecovered: (answer) => accept(answer as { state: FixState })
});

const actor = ref(props.roles[0]?.id ?? ''); const { me } = useMe(() => props.projectId);
const state = ref<FixState | null>(null);
const failure = ref<ApiFailure | null>(null);
const busy = ref('');

const filter = computed(() => ({ issues: props.issues }));

/** Отказ приложения — не поломка: он говорит, что предохранитель сработал. */
const refused = computed(() => {
  if (!state.value) return '';
  if (state.value.foreign.length) {
    return t('fx.foreign', { ids: state.value.foreign.join(', ') });
  }
  if (state.value.approvals.length) {
    return t('fx.approvals', { ids: state.value.approvals.join(', ') });
  }
  return '';
});

async function apply() {
  failure.value = null;
  const result = await stream<{ state: FixState }>(`/api/projects/${props.projectId}/fix`, {
    plan: props.plan,
    ...filter.value
  });
  if (!result) return;

  accept(result);
}

function accept(result: { state: FixState }) {
  state.value = result.state;
}

async function decide(action: 'accept' | 'reject') {
  busy.value = action;
  failure.value = null;
  try {
    const response = await $fetch<{ state: FixState } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/fix/work`,
      { method: 'POST', body: { action, actor: actor.value, ...filter.value }, ignoreResponseError: true }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    state.value = (response as { state: FixState }).state;
    emit('changed');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <div class="mt-4 space-y-3 border-t border-default pt-4">
    <div class="flex flex-wrap items-center gap-3">
      <UButton v-can="'work'" v-if="!running" icon="i-lucide-check" @click="apply">
        {{ state?.started ? t('fx.again') : t('fx.take') }}
      </UButton>

      <p v-if="!running && !state?.started" class="min-w-0 flex-1 text-sm text-muted">
        {{ t('fx.plan') }}
      </p>

      <USelect
        v-if="(props.roles.length) && !me.required"
        v-model="actor"
        size="sm"
        class="ml-auto w-44"
        :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
      /><span v-if="me.required && me.user" class="text-sm text-muted">{{ t('tw.signedIn') }}: {{ me.user.name }}</span>
    </div>

    <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
    <ModelLog :lines="log" :running="running" />

    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />

    <template v-if="state?.started && state.files.length">
      <div class="flex flex-wrap items-center gap-3">
        <h3 class="font-medium">{{ t('tw.changed', { n: state.files.length }) }}</h3>
        <!-- Предохранитель сработал — это не поломка, а работа (docs/04-ui.md). -->
        <UBadge v-if="refused" color="error" variant="subtle">{{ t('fx.refused') }}</UBadge>
      </div>

      <ul class="space-y-1 text-xs">
        <li
          v-for="file in state.files"
          :key="file"
          class="font-mono"
          :class="state.foreign.includes(file) || state.approvals.includes(file) ? 'text-error' : 'text-muted'"
        >{{ file }}</li>
      </ul>

      <p v-if="refused" class="text-sm text-error">{{ refused }}</p>

      <pre class="max-h-96 overflow-auto rounded bg-elevated p-3 text-xs">{{ state.diff }}</pre>

      <div class="flex flex-wrap items-center gap-3">
        <UButton v-can="'work'" color="primary" :loading="busy === 'accept'" :disabled="!!refused" @click="decide('accept')">
          {{ t('tw.accept') }}
        </UButton>
        <UButton v-can="'work'" variant="ghost" color="neutral" :loading="busy === 'reject'" @click="decide('reject')">
          {{ t('tw.reject') }}
        </UButton>
        <p class="min-w-0 flex-1 text-sm text-muted">
          {{ t('fx.journal') }}
        </p>
      </div>
    </template>

    <p v-else-if="state?.started" class="text-sm text-muted">
      {{ t('fx.noChanges') }}
    </p>
  </div>
</template>
