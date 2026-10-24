<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { reviewerOf, roleName } from '~~/server/lib/reviewer';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * Ревьюер в карточке задачи (docs/adr/0030-task-reviewer.md): кто принимает задачу и почему.
 * «По правилу» убирает поле `reviewer` — роль снова выводится из проверок и типа изменения.
 */
const props = defineProps<{
  projectId: string;
  task: IndexRecord;
  records: IndexRecord[];
  roles: { id: string; name: string }[];
}>();
const emit = defineEmits<{ changed: [] }>();

const RULE = '__rule__';
const pick = computed(() => reviewerOf(props.task, props.records, props.roles));
const unknownRole = computed(() => !!pick.value?.explicit && props.roles.length > 0
  && !props.roles.some((role) => role.id === pick.value?.role));
const { t } = useT();
const items = computed(() => [
  { label: t('rv.rule'), value: RULE },
  ...props.roles.map((role) => ({ label: role.name, value: role.id }))
]);

const busy = ref(false);
const failure = ref<ApiFailure | null>(null);

async function choose(value: string) {
  busy.value = true;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/records/${props.task.id}`, {
      method: 'PATCH',
      body: { reviewer: value === RULE ? null : value, version: props.task.version },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) failure.value = problem;
    else emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-medium">{{ t('rv.title') }}</h2>
    </template>
    <div class="flex flex-wrap items-center gap-3 text-sm">
      <p v-if="pick" class="min-w-0 flex-1">
        <span class="font-medium">{{ roleName(pick.role, props.roles) }}</span>
        <span class="text-muted"> — {{ pick.explicit ? t('rv.explicit') : t('rv.byRule', { why: pick.why }) }}</span>
        <span v-if="unknownRole" class="text-warning"> · {{ t('rv.unknown') }}</span>
      </p>
      <p v-else class="min-w-0 flex-1 text-warning">
        {{ t('rv.none') }}
      </p>
      <USelect
        v-if="props.roles.length"
        class="w-48"
        size="sm"
        :model-value="pick?.explicit ? pick.role : RULE"
        :items="items"
        :disabled="busy"
        @update:model-value="(value) => choose(String(value))"
      />
    </div>
    <UAlert
      v-if="failure"
      class="mt-3"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
    />
  </UCard>
</template>
