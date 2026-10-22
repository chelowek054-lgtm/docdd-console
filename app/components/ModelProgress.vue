<script setup lang="ts">
import type { ModelOutcome } from '~/stores/modelJobs'; const { t } = useT();

/**
 * Ход запроса к модели и его итог (docs/04-ui.md, раздел «Запрос к модели»).
 * Пока идёт — сколько прошло, сколько ждём и «Отменить». Кончилось — чем
 * кончилось. Один вид ожидания на все места, откуда зовут модель.
 */
const props = defineProps<{
  running: boolean;
  /** Секунды с начала запроса. */
  elapsed: number;
  outcome: ModelOutcome | null;
}>();

const emit = defineEmits<{ cancel: [] }>();

const failure = computed(() => (props.outcome?.kind === 'failure' ? props.outcome.failure : null));
</script>

<template>
  <div v-if="props.running" class="flex flex-wrap items-center gap-3 rounded bg-elevated px-3 py-2">
    <UIcon name="i-lucide-loader-circle" class="animate-spin text-(color:--ds-color-accent-text)" />
    <p class="text-sm">
      {{ t('t83.model-progress.1', { p: duration(props.elapsed * 1000) }) }}
      <!-- Срока нет: сколько ждать, решает тот, кто ждёт (docs/04-ui.md). -->
      <span class="text-muted">{{ t('t83.model-progress.2') }}</span>
    </p>
    <UButton size="xs" variant="ghost" color="neutral" class="ml-auto" @click="emit('cancel')">
      {{ t('t83.model-jobs-bar.2') }}
    </UButton>
  </div>

  <template v-else-if="props.outcome">
    <p v-if="props.outcome.kind === 'answer'" class="text-sm text-muted">
      {{ t('t83.model-progress.3', { p: duration(props.outcome.ms) }) }}
    </p>

    <p v-else-if="props.outcome.kind === 'cancelled'" class="text-sm text-muted">
      {{ t('t83.model-progress.4', { p: duration(props.outcome.ms) }) }}
    </p>

    <UAlert
      v-else-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />
  </template>
</template>
