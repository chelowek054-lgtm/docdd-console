<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ProposedRecord } from '~~/server/lib/inbox';

/**
 * «Восстановить „как есть“» (R-0078, docs/04-ui.md, «Подключение»): для готовой
 * кодовой базы модель предлагает возможности функциональной карты со свидетельством
 * в коде и требования «как есть». Список правит человек; записи заводит приложение
 * **черновиками**, подтверждение — пачкой через «Приём изменений».
 */
const props = defineProps<{ projectId: string }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

const { running, elapsed, outcome, stream, cancel } = useModelRequest(() => `${props.projectId}:as-is`, { label: t('asis.title') });

const proposed = ref<ProposedRecord[]>([]);
const problems = ref<string[]>([]);
const dropped = ref<string[]>([]);
const created = ref<{ id: string; type: string; title: string }[]>([]);
const trouble = ref<ApiFailure | null>(null);
const busy = ref(false);

const kept = computed(() => proposed.value.filter((record) => !dropped.value.includes(record.key)));
const toggle = (key: string) => { dropped.value = dropped.value.includes(key) ? dropped.value.filter((item) => item !== key) : [...dropped.value, key]; };

async function analyse() {
  trouble.value = null;
  proposed.value = [];
  problems.value = [];
  created.value = [];
  dropped.value = [];
  const built = await $fetch<{ prompt: string } | { error: ApiFailure }>(`/api/projects/${props.projectId}/prompt`, { method: 'POST', body: { kind: 'as-is' }, ignoreResponseError: true });
  const problem = failureOf(built);
  if (problem) { trouble.value = problem; return; }
  const answer = await stream<{ answer: string }>('/api/llm/ask', { prompt: (built as { prompt: string }).prompt, projectId: props.projectId });
  if (!answer) return;
  const parsed = await $fetch<{ records: ProposedRecord[]; problems: string[] } | { error: ApiFailure }>(`/api/projects/${props.projectId}/inbox/preview`, { method: 'POST', body: { answer: answer.answer }, ignoreResponseError: true });
  const broken = failureOf(parsed);
  if (broken) { trouble.value = broken; return; }
  proposed.value = (parsed as { records: ProposedRecord[] }).records;
  problems.value = (parsed as { problems: string[] }).problems;
}

async function create() {
  busy.value = true;
  trouble.value = null;
  try {
    const response = await $fetch<{ created: { id: string; type: string; title: string }[]; problems: string[] } | { error: ApiFailure }>(`/api/projects/${props.projectId}/inbox/records`, { method: 'POST', body: { records: kept.value, notes: [] }, ignoreResponseError: true });
    const problem = failureOf(response);
    if (problem) { trouble.value = problem; return; }
    created.value = (response as { created: { id: string; type: string; title: string }[] }).created;
    proposed.value = [];
    emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-lucide-scan-search" class="size-5 text-primary" />
        <h2 class="font-medium">{{ t('asis.title') }}</h2>
        <span class="text-sm text-muted">{{ t('asis.hint') }}</span>
      </div>
    </template>
    <div class="space-y-3 text-sm">
      <UButton icon="i-lucide-sparkles" :loading="running" :disabled="running" @click="analyse">{{ t('asis.run') }}</UButton>
      <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
      <UAlert v-if="trouble" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="trouble.message" :description="trouble.detail" />

      <ul v-if="problems.length" class="space-y-0.5 text-xs text-warning">
        <li v-for="(problem, at) in problems" :key="at">{{ problem }}</li>
      </ul>

      <template v-if="proposed.length">
        <p class="font-medium">{{ t('asis.proposed', { n: proposed.length }) }}</p>
        <ul class="space-y-1">
          <li v-for="record in proposed" :key="record.key" class="flex items-start gap-2 rounded border border-default p-2" :class="dropped.includes(record.key) ? 'opacity-50' : ''">
            <UCheckbox :model-value="!dropped.includes(record.key)" @update:model-value="toggle(record.key)" />
            <span class="min-w-0 flex-1">
              <UBadge size="sm" variant="outline" color="neutral">{{ record.type }}</UBadge>
              <span class="ml-2 font-medium">{{ record.title }}</span>
              <span v-if="record.capabilities?.length" class="block text-xs text-muted">{{ t('asis.capabilities', { n: record.capabilities.length }) }}</span>
            </span>
          </li>
        </ul>
        <div class="flex items-center gap-3">
          <UButton :loading="busy" :disabled="!kept.length" @click="create">{{ t('asis.create', { n: kept.length }) }}</UButton>
          <span class="text-xs text-muted">{{ t('asis.draftNote') }}</span>
        </div>
      </template>

      <div v-if="created.length" class="space-y-1">
        <p class="text-success">{{ t('asis.created', { n: created.length }) }}</p>
        <NuxtLink :to="`/projects/${projectId}/documents`" class="text-primary underline">{{ t('asis.review') }}</NuxtLink>
      </div>
    </div>
  </UCard>
</template>
