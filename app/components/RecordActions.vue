<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { RecordAction } from '~~/server/lib/types';

const props = defineProps<{
  projectId: string;
  recordId: string;
  actions: RecordAction[];
  roles: { id: string; name: string }[];
}>();

const emit = defineEmits<{ changed: [] }>();

const actor = ref(props.roles[0]?.id ?? '');
const busy = ref('');
const failure = ref<ApiFailure | null>(null);
const done = ref('');

async function run(action: RecordAction) {
  busy.value = action.status;
  failure.value = null;
  done.value = '';
  try {
    const response = await $fetch<{ journal?: string } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/records/${props.recordId}/status`,
      {
        method: 'POST',
        body: { status: action.status, actor: actor.value },
        // Отказ приходит телом ответа: причину показываем как есть.
        ignoreResponseError: true
      }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    done.value = (response as { journal?: string }).journal ?? '';
    emit('changed');
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">Действия</h2>
        <USelect
          v-if="props.roles.length"
          v-model="actor"
          size="sm"
          class="ml-auto w-48"
          :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
        />
      </div>
    </template>

    <p v-if="props.actions.length === 0" class="text-sm text-muted">
      Из этого статуса переходов нет.
    </p>

    <ul v-else class="space-y-3">
      <li v-for="action in props.actions" :key="action.status">
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            :disabled="!action.allowed"
            :loading="busy === action.status"
            :variant="action.allowed ? 'solid' : 'outline'"
            :color="action.allowed ? 'primary' : 'neutral'"
            size="sm"
            @click="run(action)"
          >
            {{ action.label }}
          </UButton>
          <!-- Пустая серая кнопка без объяснения бесполезна: человек должен
               понимать, что именно чинить (docs/04-ui.md). -->
          <p v-if="!action.allowed" class="min-w-0 flex-1 text-sm text-muted">
            {{ action.blockers.map((blocker) => blocker.message).join(' ') }}
          </p>
        </div>
      </li>
    </ul>

    <UAlert
      v-if="failure"
      class="mt-4"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="(failure.blockers ?? []).map((blocker) => blocker.message).join(' ') || failure.detail"
    />

    <UAlert
      v-else-if="done"
      class="mt-4"
      color="success"
      variant="subtle"
      icon="i-lucide-check"
      title="Статус изменён"
      :description="`В журнал добавлено: ${done}`"
    />
  </UCard>
</template>
