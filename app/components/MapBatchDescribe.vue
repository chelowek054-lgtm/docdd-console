<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { useModelJobs } from '~/stores/modelJobs';
import { describeBatch, type BatchStep } from '~/utils/batch-describe';
import { MAX_REQUEST_FILES, batchPlan } from '../../server/lib/inventory';
const { t, tn } = useT();

/**
 * «Описать пачками» (docs/07-maps.md, «Описать всё пачками»): запустить один раз
 * и не нажимать «Обновить карты» на каждый заход. Расход остаётся в руках
 * человека: он называет размер запроса и потолок на прогон, видит число
 * запросов до нажатия, может остановить, а прогон сам встаёт на первом отказе.
 * Результат — черновики карт: подтверждает по-прежнему человек, и файлы выходят
 * из очереди только тогда.
 */
const props = defineProps<{
  projectId: string;
  /** Сколько файлов ждёт очереди (новые и изменившиеся). */
  left: number;
  /** Порция проекта — размер запроса по умолчанию. */
  portion: number;
}>();

const emit = defineEmits<{ changed: [] }>();

const open = ref(false);
const size = ref(props.portion);
const total = ref(props.left);
// Очередь меняется (подтвердили черновики) — потолок подтягивается к ней, пока человек его не трогал.
const touched = ref(false);
watch(() => props.left, (value) => { if (!touched.value) total.value = value; });
watch(() => props.portion, (value) => { size.value = value; });

const plan = computed(() => batchPlan(props.left, size.value || 1, total.value || 0));
const valid = computed(() => Number.isInteger(size.value) && size.value >= 1 && size.value <= MAX_REQUEST_FILES
  && Number.isInteger(total.value) && total.value >= 1);

const { data: llm } = useFetch<{ available: boolean; reason: string | null }>('/api/llm', { key: 'llm' });
const { running: asking, elapsed, outcome, stream, cancel } = useModelRequest(() => `${props.projectId}:maps-batch`, { label: t('t83.m2.batch.label') });

// Состояние прогона — в хранилище: цикл переживает страницу, и страница, открытая позже, видит его ход.
const batch = useModelJobs().batchOf(`${props.projectId}:maps-batch`);
const running = computed(() => batch.running);
const progress = computed(() => batch.progress);
const finished = computed(() => batch.finished);

async function step(skip: number, limit: number): Promise<BatchStep> {
  const number = Math.floor(skip / size.value) + 1;
  const built = await $fetch<{ prompt: string; count: number } | { error: ApiFailure }>(
    `/api/projects/${props.projectId}/prompt`,
    { method: 'POST', body: { kind: 'maps', skip, limit }, ignoreResponseError: true }
  );
  const problem = failureOf(built);
  if (problem) return { ok: false, reason: problem.message, empty: problem.code === 'nothing_to_describe' };
  const { prompt, count } = built as { prompt: string; count: number };

  // Цикл дольше страницы: ответ нужен ему самому, уход со страницы его не останавливает.
  const result = await stream<{ answer: string }>('/api/llm/ask', { prompt, projectId: props.projectId }, { background: true });
  if (!result) {
    const said = outcome.value;
    if (batch.stop || said?.kind === 'cancelled') return { ok: false, reason: t('t83.m2.batch.stopped') };
    return { ok: false, reason: said?.kind === 'failure' ? said.failure.message : t('t83.m2.batch.noAnswer') };
  }

  // Ответ сохраняется черновиком — тем же путём, что и «Сохранить черновиком» вручную.
  const draft = await $fetch<{ record?: { id: string } } | { error: ApiFailure }>(
    `/api/projects/${props.projectId}/map/draft`,
    { method: 'POST', body: { answer: result.answer, title: t('t83.m2.batch.title', { n: number }) }, ignoreResponseError: true }
  );
  const refusal = failureOf(draft);
  if (refusal) return { ok: false, reason: t('t83.m2.batch.notSaved', { message: refusal.message }) };
  return { ok: true, draft: (draft as { record?: { id: string } }).record?.id ?? '', count };
}

async function start() {
  if (!valid.value || batch.running) return;
  batch.running = true;
  batch.stop = false;
  batch.finished = null;
  batch.progress = { planned: plan.value.steps, done: 0, files: 0, drafts: [], reason: null };
  try {
    batch.finished = await describeBatch({
      size: size.value,
      total: total.value,
      left: props.left,
      step,
      stopped: () => batch.stop,
      onProgress: (run) => { batch.progress = run; }
    });
  } finally {
    batch.running = false;
    batch.progress = null;
    emit('changed');
  }
}

function stop() {
  batch.stop = true;
  cancel();
}

// Закрыли страницу — прогон продолжается в фоне (docs/04-ui.md, «Запрос к модели»): остановить его
// можно кнопкой здесь или «Отменить» в списке заданий в шапке.

const summary = computed(() => {
  const run = finished.value;
  if (!run) return '';
  const head = t('t83.m2.batch.head', { done: run.done, planned: run.planned, files: tn('t83.m2.pl.file', run.files), drafts: tn('t83.m2.pl.draft', run.drafts.length) });
  return run.reason ? t('t83.m2.batch.stoppedWhy', { head, reason: run.reason }) : `${head}.`;
});
</script>

<template>
  <div v-if="left > 0" class="mt-2">
    <UButton size="xs" variant="soft" icon="i-lucide-layers" @click="open = !open">
      {{ t('t83.map-batch-describe.1') }}
    </UButton>

    <div v-if="open" class="mt-2 space-y-3 ds-card p-3 text-sm">
      <div class="flex flex-wrap items-end gap-4">
        <UFormField :label="t('t83.map-batch-describe.2')" :description="`от 1 до ${MAX_REQUEST_FILES}`">
          <UInput v-model.number="size" type="number" :min="1" :max="MAX_REQUEST_FILES" class="w-28" :disabled="running" />
        </UFormField>
        <UFormField :label="t('t83.map-batch-describe.3')" :description="t('t83.m2.batch.queued', { left })">
          <UInput v-model.number="total" type="number" :min="1" class="w-28" :disabled="running" @update:model-value="touched = true" />
        </UFormField>
        <p class="pb-2 text-muted">
          <template v-if="valid">
            {{ t('t83.m2.batch.upTo', { steps: tn('t83.m2.pl.request', plan.steps), files: tn('t83.m2.pl.file', plan.files) }) }}
          </template>
          <template v-else>{{ t('t83.map-batch-describe.4', { MAX_REQUEST_FILES: MAX_REQUEST_FILES }) }}</template>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton v-if="!running" size="sm" :disabled="!valid || !llm?.available" @click="start">{{ t('t83.map-batch-describe.5') }}</UButton>
        <UButton v-else size="sm" color="error" variant="soft" icon="i-lucide-square" @click="stop">{{ t('t83.map-batch-describe.6') }}</UButton>
        <p v-if="!llm?.available && !running" class="text-muted">{{ llm?.reason }}</p>
      </div>

      <p v-if="progress" class="text-muted">
        {{ t('t83.map-batch-describe.7', { p: Math.min(progress.done + 1, progress.planned), planned: progress.planned, length: progress.drafts.length, files: progress.files, files2: plan.files }) }}<template v-if="asking"> {{ t('t83.map-batch-describe.8', { elapsed: elapsed }) }}</template>
      </p>

      <div v-if="finished" class="space-y-1">
        <p :class="finished.reason ? 'text-warning' : 'text-success'">{{ summary }}</p>
        <ul v-if="finished.drafts.length" class="flex flex-wrap gap-x-3 text-xs">
          <li v-for="id in finished.drafts" :key="id">
            <NuxtLink :to="`/projects/${projectId}/records/${id}`" class="font-mono hover:underline">{{ id }}</NuxtLink>
          </li>
        </ul>
        <p v-if="finished.drafts.length" class="text-xs text-muted">
          {{ t('t83.map-batch-describe.9') }}
        </p>
      </div>
    </div>
  </div>
</template>
