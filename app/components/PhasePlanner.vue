<script setup lang="ts">
import type { IndexRecord } from '~~/server/lib/types';
import { phaseCandidates } from '~~/server/lib/phase-plan';

/**
 * Кнопка «Разбить на фазы» (docs/04-ui.md, «Разбить на фазы»): запрос к модели
 * по задачам, которые ещё ни в какой фазе, и список предложенного под ним.
 * Модель только предлагает — фазы заводит приложение, когда человек нажмёт
 * «Создать фазы».
 */
const props = defineProps<{
  projectId: string;
  records: IndexRecord[];
  /** Отмеченные задачи; пусто — все подходящие. */
  picked?: string[];
}>();

const emit = defineEmits<{ changed: [] }>();

const candidates = computed(() => phaseCandidates(props.records, props.picked));
const ids = computed(() => candidates.value.map((task) => task.id));
</script>

<template>
  <PromptPanel
    :project-id="props.projectId"
    kind="phases"
    :tasks="ids"
    :label="candidates.length ? `Разбить на фазы: ${candidates.length}` : 'Разбить на фазы'"
    :hint="`задач в запросе: ${candidates.length}`"
    :disabled="candidates.length === 0"
    disabled-reason="Все задачи уже в фазах или отменены — разбивать нечего."
  >
    <template #answer="{ answer }">
      <PhasePlan :project-id="props.projectId" :answer="answer" :tasks="ids" @changed="emit('changed')" />
    </template>
  </PromptPanel>
</template>
