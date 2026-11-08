<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ReviewQuestion, ReviewVerdict } from '~~/server/lib/review-questions';

/**
 * Проверка задачи вопросами (R-0117): модель спрашивает, человек отвечает, а закрывает задачу
 * отдельной кнопкой. Ответ «нет» предлагает доработку с текстами вопросов; решает снова человек.
 */
const props = defineProps<{ projectId: string; recordId: string; actor: string }>();
const emit = defineEmits<{ rework: [text: string]; saved: [] }>();
const { t } = useT();

interface Row extends ReviewQuestion { verdict: ReviewVerdict | ''; comment: string }
interface Reply { questions: ReviewQuestion[]; problem?: string }

const rows = ref<Row[]>([]);
const problem = ref('');
const summary = ref('');
const rework = ref('');
const failure = ref<ApiFailure | null>(null);
const saving = ref(false);

const { data: llm } = useLazyFetch<{ available: boolean; reason: string | null }>('/api/llm', { key: 'llm' });
const { running, elapsed, outcome, log, stream, cancel } = useModelRequest(() => `${props.projectId}:${props.recordId}:review-questions`, {
  label: t('rq.label', { id: props.recordId }),
  onRecovered: (reply) => show(reply as Reply)
});

const url = computed(() => `/api/projects/${props.projectId}/records/${props.recordId}`);
const VERDICTS: ReviewVerdict[] = ['yes', 'no', 'unchecked'];
const complete = computed(() => rows.value.length > 0 && rows.value.every((row) => row.verdict));

function show(reply: Reply) {
  problem.value = reply.problem ?? '';
  rows.value = reply.questions.map((question) => ({ ...question, verdict: '', comment: '' }));
}

async function ask() {
  failure.value = null; summary.value = ''; rework.value = ''; problem.value = ''; rows.value = [];
  const reply = await stream<Reply>(`${url.value}/review-questions`, {});
  if (reply) show(reply);
}

async function save() {
  saving.value = true; failure.value = null;
  try {
    const reply = await $fetch<{ summary: string; rework: string } | { error: ApiFailure }>(`${url.value}/review-answers`, {
      method: 'POST', body: { answers: rows.value, actor: props.actor }, ignoreResponseError: true
    });
    if (failureOf(reply)) { failure.value = failureOf(reply); return; }
    const saved = reply as { summary: string; rework: string };
    summary.value = saved.summary; rework.value = saved.rework; rows.value = [];
    emit('saved');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="mt-4 space-y-3 border-t border-default pt-4">
    <div class="flex flex-wrap items-center gap-3">
      <h3 class="font-medium">{{ t('rq.title') }}</h3>
      <UButton size="sm" icon="i-lucide-list-checks" :loading="running" :disabled="running || !llm?.available" :label="rows.length ? t('rq.again') : t('rq.ask')" @click="ask" />
      <p v-if="llm && !llm.available" class="min-w-0 flex-1 text-sm text-muted">{{ llm.reason }}</p>
    </div>
    <p class="text-xs text-muted">{{ t('rq.hint') }}</p>

    <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
    <ModelLog :lines="log" :running="running" />
    <UAlert v-if="problem" color="warning" variant="subtle" :title="t('rq.badReply')" :description="problem" />
    <UAlert v-if="failure" color="error" variant="subtle" :title="failure.message" />

    <ol v-if="rows.length" class="space-y-4 text-sm">
      <li v-for="(row, at) in rows" :key="row.text" class="space-y-1">
        <p class="font-medium">{{ at + 1 }}. {{ row.text }}</p>
        <p class="text-muted">{{ t('rq.how') }}: {{ row.how }}</p>
        <p class="text-muted">{{ t('rq.expected') }}: {{ row.expected }}</p>
        <div class="flex flex-wrap items-center gap-2 pt-1">
          <UButton
            v-for="verdict in VERDICTS"
            :key="verdict"
            size="xs"
            :variant="row.verdict === verdict ? 'solid' : 'outline'"
            :color="row.verdict === verdict && verdict === 'no' ? 'error' : row.verdict === verdict ? 'primary' : 'neutral'"
            :label="t(`rq.verdict.${verdict}`)"
            :aria-pressed="row.verdict === verdict"
            @click="row.verdict = verdict"
          />
          <UInput v-model="row.comment" size="xs" class="min-w-48 flex-1" :placeholder="t('rq.comment')" />
        </div>
      </li>
    </ol>
    <UButton v-if="rows.length" v-can="'approve'" :loading="saving" :disabled="!complete" :label="t('rq.save')" @click="save" />

    <p v-if="summary" class="text-sm">{{ t('rq.saved') }}: {{ summary }}</p>
    <div v-if="rework" class="space-y-2">
      <pre class="whitespace-pre-wrap rounded bg-elevated p-3 text-xs">{{ rework }}</pre>
      <UButton v-can="'work'" color="warning" variant="soft" icon="i-lucide-undo-2" :label="t('rq.rework')" @click="emit('rework', rework)" />
    </div>
  </section>
</template>
