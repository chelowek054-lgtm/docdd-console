<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { IndexRecord } from '~~/server/lib/types';

const props = defineProps<{ projectId: string; type: string; records: IndexRecord[] }>();
const emit = defineEmits<{ created: [] }>();

const open = ref(false);
const title = ref('');
const owner = ref('');
const implementsIds = ref<string[]>([]);
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);

/** Связь `implements` предлагается сразу: задача без требования — дефект процесса. */
const requirements = computed(() => props.records
  .filter((record) => record.type === 'requirement' && record.status === 'approved')
  .map((record) => ({ label: `${record.id} · ${record.title}`, value: record.id })));

async function create() {
  if (!title.value.trim()) return;
  busy.value = true;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/records`, {
      method: 'POST',
      body: {
        type: props.type,
        title: title.value.trim(),
        owner: owner.value.trim() || undefined,
        links: implementsIds.value.length ? { implements: implementsIds.value } : undefined
      },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    title.value = '';
    owner.value = '';
    implementsIds.value = [];
    open.value = false;
    emit('created');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <UButton size="sm" icon="i-lucide-plus" variant="soft" @click="open = !open">
      Новая запись
    </UButton>

    <UCard v-if="open" class="mt-3">
      <div class="space-y-3">
        <UInput v-model="title" placeholder="Заголовок записи" @keyup.enter="create" />
        <UInput v-model="owner" placeholder="Исполнитель — необязательно" />
        <USelectMenu
          v-if="props.type === 'task' && requirements.length"
          v-model="implementsIds"
          multiple
          value-key="value"
          :items="requirements"
          placeholder="Какое требование выполняет"
        />
        <!-- Идентификатор выдаёт сервер: номера не переиспользуются, поэтому
             выбрать его вручную нельзя (docs/02-workspace-contract.md). -->
        <p class="text-xs text-muted">
          Номер выдаст сервер — следующий свободный. Запись заводится черновиком:
          статус меняется действиями на её экране.
        </p>
        <div class="flex gap-2">
          <UButton :loading="busy" :disabled="!title.trim()" @click="create">Создать</UButton>
          <UButton variant="ghost" color="neutral" @click="open = false">Отмена</UButton>
        </div>

        <UAlert
          v-if="failure"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="failure.message"
          :description="failure.detail"
        />
      </div>
    </UCard>
  </div>
</template>
