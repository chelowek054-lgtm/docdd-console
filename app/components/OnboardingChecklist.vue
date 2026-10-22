<script setup lang="ts">
import type { Readiness, Step, StepResult } from '~~/server/lib/onboarding';

/**
 * Чек-лист «Готовность проекта» (R-0075, docs/04-ui.md, «Подключение»): шаги
 * подключения со статусом, вычисленным по состоянию проекта. Кратко — карточка
 * на обзоре; полностью — вкладка «Подключение» с кнопкой «Запустить подключение».
 */
const props = defineProps<{ projectId: string; compact?: boolean }>();
const { t } = useT();

interface Report { steps: Step[]; readiness: Readiness }
const { data, refresh } = useFetch<Report>(() => `/api/projects/${props.projectId}/onboarding`, { key: () => `onboarding:${props.projectId}`, server: false, lazy: true });

const running = ref(false);
const results = ref<StepResult[]>([]);
const failure = ref('');

async function run(step?: string) {
  running.value = true;
  failure.value = '';
  try {
    const response = await $fetch<{ ran?: StepResult[]; error?: { message: string } }>(`/api/projects/${props.projectId}/onboarding/run`, {
      method: 'POST', body: step ? { step, force: true } : {}, ignoreResponseError: true
    });
    if (response.error) failure.value = response.error.message;
    else results.value = response.ran ?? [];
    await refresh();
  } finally {
    running.value = false;
  }
}

const ICON = { done: 'i-lucide-circle-check', awaiting: 'i-lucide-hourglass', not_started: 'i-lucide-circle' } as const;
const TEXT = { done: 'text-success', awaiting: 'text-warning', not_started: 'text-muted' } as const;
const COLOR = { done: 'success', awaiting: 'warning', not_started: 'neutral' } as const;
const resultOf = (id: string) => results.value.find((item) => item.step === id);
</script>

<template>
  <UCard v-if="data">
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">{{ t('ob.title') }}</h2>
        <UBadge color="neutral" variant="soft">{{ t('ob.done', { done: data.readiness.done, total: data.readiness.total }) }}</UBadge>
        <UProgress :model-value="data.readiness.percent" :max="100" size="sm" class="min-w-24 flex-1" />
        <UButton v-if="!compact" icon="i-lucide-play" :loading="running" @click="run()">{{ t('ob.run') }}</UButton>
        <UButton v-else size="xs" variant="soft" :to="`/projects/${projectId}/fill?tab=onboarding`">{{ t('ob.open') }}</UButton>
      </div>
    </template>
    <ul class="divide-y divide-default text-sm">
      <li v-for="step in compact ? data.steps.filter((item) => item.status !== 'done').slice(0, 3) : data.steps" :key="step.id" class="flex flex-wrap items-center gap-2 py-2">
        <UIcon :name="ICON[step.status]" class="size-4 shrink-0" :class="TEXT[step.status]" />
        <span class="min-w-0 flex-1">
          <span class="font-medium">{{ t(`ob.step.${step.id}`) }}</span>
          <span class="block text-xs text-muted">{{ step.detail }}</span>
          <span v-if="resultOf(step.id)" class="block text-xs" :class="resultOf(step.id)!.ok ? 'text-success' : 'text-error'">{{ resultOf(step.id)!.summary }}</span>
        </span>
        <UBadge :color="COLOR[step.status]" variant="subtle" size="sm">{{ t(`ob.status.${step.status}`) }}</UBadge>
        <UBadge color="neutral" variant="outline" size="sm">{{ t(`ob.via.${step.via}`) }}</UBadge>
        <template v-if="!compact">
          <UButton v-if="step.via === 'auto'" size="xs" variant="ghost" color="neutral" icon="i-lucide-rotate-cw" :loading="running" :aria-label="t('ob.rerun')" @click="run(step.id)" />
          <UButton v-else size="xs" variant="ghost" color="neutral" icon="i-lucide-arrow-right" :to="`/projects/${projectId}/${step.to}`" :aria-label="t('ob.go')" />
        </template>
      </li>
    </ul>
    <p v-if="compact && data.readiness.done === data.readiness.total" class="text-sm text-success">{{ t('ob.allDone') }}</p>
    <p v-if="failure" class="mt-2 text-sm text-error">{{ failure }}</p>
    <p v-if="!compact" class="mt-3 text-xs text-muted">{{ t('ob.note') }}</p>
  </UCard>
</template>
