<script setup lang="ts">
import type { ModelOutcome } from '~/composables/useModelRequest';

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
    <UIcon name="i-lucide-loader-circle" class="animate-spin text-primary" />
    <p class="text-sm">
      Модель работает — {{ duration(props.elapsed * 1000) }}
      <!-- Срока нет: сколько ждать, решает тот, кто ждёт (docs/04-ui.md). -->
      <span class="text-muted">· остановить можно кнопкой</span>
    </p>
    <UButton size="xs" variant="ghost" color="neutral" class="ml-auto" @click="emit('cancel')">
      Отменить
    </UButton>
  </div>

  <template v-else-if="props.outcome">
    <p v-if="props.outcome.kind === 'answer'" class="text-sm text-muted">
      Ответ за {{ duration(props.outcome.ms) }}.
    </p>

    <p v-else-if="props.outcome.kind === 'cancelled'" class="text-sm text-muted">
      Отменено через {{ duration(props.outcome.ms) }}. Программа снята — ничего не осталось работать в фоне.
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
