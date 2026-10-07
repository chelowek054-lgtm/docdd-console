<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { referenceChoices, withReuses } from '~~/server/lib/task-order';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * Справочник в карточке задачи (docs/04-ui.md, «Справочник»): задача `feature` в
 * работе, а справочник не просмотрен — выбрать справку, которую она
 * переиспользует, или записать «подходящего нет». Напоминание, не запрет.
 */
const props = defineProps<{ projectId: string; task: IndexRecord; records: IndexRecord[] }>();
const emit = defineEmits<{ changed: [] }>();

const { data } = useFetch<{ enabled: boolean } | { error: ApiFailure }>(
  () => `/api/projects/${props.projectId}/reference`,
  { key: () => `reference-on:${props.projectId}` }
);
const enabled = computed(() => !!data.value && 'enabled' in data.value && data.value.enabled);

const READY = ['ready', 'in_progress', 'in_review'];
const unchecked = computed(() => enabled.value
  && props.task.extra['change'] === 'feature'
  && READY.includes(props.task.status)
  && (props.task.links.reuses ?? []).length === 0
  && props.task.extra['reuse'] !== 'none');

const query = ref('');
const choices = computed(() => referenceChoices(props.records, query.value));
const busy = ref('');
const failure = ref<ApiFailure | null>(null);

async function save(body: Record<string, unknown>, key: string) {
  busy.value = key;
  failure.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/records/${props.task.id}`, {
      method: 'PATCH',
      body,
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) failure.value = problem;
    else emit('changed');
  } finally {
    busy.value = '';
  }
}

const reuse = (id: string) => save({ links: withReuses(props.task.links, id) }, id);
const none = () => save({ reuse: 'none' }, 'none');
</script>

<template>
  <UCard v-if="unchecked">
    <template #header>
      <h2 class="font-medium">Что уже есть: справочник</h2>
    </template>
    <div class="space-y-3">
      <p class="text-sm text-muted">
        Задача на новый функционал не смотрела справочник. Загляните в индекс: если что-то подходит — привяжите справку, и задача её переиспользует; нет — запишите «подходящего нет».
      </p>
      <UInput v-model="query" size="sm" class="w-full" placeholder="Найти справку по номеру или названию" />
      <p v-if="choices.length === 0" class="text-sm text-muted">Подходящих справок нет.</p>
      <ul v-else class="space-y-1">
        <li v-for="item in choices" :key="item.id" class="flex flex-wrap items-center gap-3 text-sm">
          <span class="font-mono text-xs text-muted">{{ item.id }}</span>
          <span class="min-w-0 flex-1">{{ item.title }}<span v-if="item.summary" class="text-muted"> — {{ item.summary }}</span></span>
          <UButton size="xs" variant="soft" :loading="busy === item.id" :disabled="busy !== ''" @click="reuse(item.id)">Переиспользует</UButton>
        </li>
      </ul>
      <UButton size="sm" variant="outline" color="neutral" :loading="busy === 'none'" :disabled="busy !== ''" @click="none">
        Подходящего нет
      </UButton>
      <UAlert v-if="failure" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="failure.message" :description="failure.detail" />
    </div>
  </UCard>
</template>
