<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * Строка намерения на стратегической карте (docs/adr/0037-strategy-intent-input.md): фраза
 * становится заметкой во входящем, разбирается тем же `inbox-plan` в режиме «стратегия» и
 * приходит предложением — возможность, требования, проверки, задачи. Заводятся черновики.
 * Перед разбором модель может задать до трёх уточняющих вопросов (R-0116).
 */
const props = defineProps<{ projectId: string; contours: readonly { id: string; title: string }[] }>();
const emit = defineEmits<{ created: [] }>();
const { t } = useT();

const text = ref('');
/** Значение «контур выберет модель»: у списка Nuxt UI пустого значения быть не может. */
const ANY = '__any__';
const contour = ref(ANY);
const { proposed, dropped, problems, created, outside, outsideOk, trouble, saving, kept, reset, preview, create: createRecords, toggle } = useProposal(() => props.projectId);

interface Clarify { theme: string; text: string; answer: string }
interface IntentReply { questions: { theme: string; text: string }[]; problem?: string }
const clarify = ref<Clarify[]>([]);
/** Сбой вопросов разбору не мешает, но промолчать о нём нельзя (R-0116). */
const notice = ref('');

/** Заметка, из которой идёт разбор: нужна при заведении, в том числе после перезагрузки. */
const NOTE_KEY = computed(() => `docdd.strategyIntent:${props.projectId}`);
function notePath(): string | null {
  try { return sessionStorage.getItem(NOTE_KEY.value); } catch { return null; }
}
function rememberNote(path: string | null) {
  try { if (path) sessionStorage.setItem(NOTE_KEY.value, path); else sessionStorage.removeItem(NOTE_KEY.value); } catch { /* живём без памяти вкладки */ }
}

const { running, elapsed, outcome, log, stream, cancel } = useModelRequest(() => `${props.projectId}:strategy-intent`, {
  label: t('si.label'),
  onRecovered: (answer) => void preview((answer as { answer: string }).answer)
});

const asking = useModelRequest(() => `${props.projectId}:strategy-intent-questions`, {
  label: t('si.clarifyLabel'),
  onRecovered: (reply) => void afterQuestions(reply as IntentReply)
});
const busy = computed(() => running.value || asking.running.value);

async function run(withQuestions: boolean) {
  reset();
  clarify.value = []; notice.value = '';
  const intent = text.value.trim();
  if (!intent) return;
  const note = await $fetch<{ path: string } | { error: ApiFailure }>(`/api/projects/${props.projectId}/inbox/notes`, {
    method: 'POST', body: { title: intent.split(/\r?\n/, 1)[0]!.slice(0, 80), body: intent }, ignoreResponseError: true
  });
  if (failureOf(note)) { trouble.value = failureOf(note); return; }
  const path = (note as { path: string }).path;
  rememberNote(path);
  if (!withQuestions) { await layout(); return; }
  const reply = await asking.stream<IntentReply>(`/api/projects/${props.projectId}/grill/intent`, { note: path });
  if (reply) await afterQuestions(reply);
}

/** Вопросов нет или модель не ответила — сразу разбор: намерению это не помеха. */
async function afterQuestions(reply: IntentReply) {
  if (reply.problem) notice.value = t('si.clarifyFailed', { why: reply.problem });
  if (reply.questions.length) {
    clarify.value = reply.questions.map((question) => ({ ...question, answer: '' }));
    return;
  }
  await layout();
}

async function submitAnswers() {
  const path = notePath();
  if (!path) { await layout(); return; }
  const saved = await $fetch<{ ok: true } | { error: ApiFailure }>(`/api/projects/${props.projectId}/grill/intent-answers`, {
    method: 'POST', body: { note: path, answers: clarify.value.map((item) => ({ text: item.text, answer: item.answer })) }, ignoreResponseError: true
  });
  if (failureOf(saved)) { trouble.value = failureOf(saved); return; }
  await layout();
}

async function layout() {
  clarify.value = [];
  const path = notePath();
  const built = await $fetch<{ prompt: string } | { error: ApiFailure }>(`/api/projects/${props.projectId}/prompt`, {
    method: 'POST', body: { kind: 'inbox', notes: path ? [path] : [], mode: 'strategy', contour: contour.value === ANY ? undefined : contour.value }, ignoreResponseError: true
  });
  if (failureOf(built)) { trouble.value = failureOf(built); return; }
  const answer = await stream<{ answer: string }>('/api/llm/ask', { prompt: (built as { prompt: string }).prompt, projectId: props.projectId });
  if (answer) await preview(answer.answer);
}

async function create() {
  const path = notePath();
  const done = await createRecords(kept.value, path ? [path] : []);
  if (!done) return;
  text.value = ''; rememberNote(null);
  emit('created');
}
</script>

<template>
  <UCard :ui="{ body: 'space-y-3' }">
    <div class="flex flex-wrap items-end gap-2">
      <UTextarea v-model="text" class="min-w-64 flex-1" :rows="2" autoresize :placeholder="t('si.placeholder')" :aria-label="t('si.label')" />
      <USelect
        v-model="contour"
        class="w-56"
        :items="[{ label: t('si.anyContour'), value: ANY }, ...contours.map((item) => ({ label: item.title, value: item.id }))]"
        :aria-label="t('si.contour')"
      />
      <UButton icon="i-lucide-sparkles" :loading="busy" :disabled="!text.trim() || busy" :label="t('si.run')" @click="run(true)" />
      <UButton variant="ghost" color="neutral" :disabled="!text.trim() || busy" :label="t('si.noQuestions')" @click="run(false)" />
    </div>
    <p class="text-xs text-muted">{{ t('si.hint') }}</p>

    <ModelProgress :running="asking.running.value" :elapsed="asking.elapsed.value" :outcome="asking.outcome.value" @cancel="asking.cancel" />
    <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
    <ModelLog :lines="log" :running="running" />
    <UAlert v-if="trouble" color="error" variant="subtle" :title="trouble.message" />
    <UAlert v-if="notice" color="warning" variant="subtle" :title="notice" />

    <div v-if="clarify.length" class="space-y-3">
      <p class="text-sm font-medium">{{ t('si.clarifyHead') }}</p>
      <UFormField v-for="item in clarify" :key="item.text" :label="item.text">
        <UTextarea v-model="item.answer" :rows="2" autoresize class="w-full" />
      </UFormField>
      <div class="flex flex-wrap gap-2">
        <UButton :disabled="busy" :label="t('si.clarifySend')" @click="submitAnswers" />
        <UButton variant="ghost" color="neutral" :disabled="busy" :label="t('si.noQuestions')" @click="layout" />
      </div>
    </div>

    <template v-if="proposed.length">
      <UAlert v-if="outside" color="warning" variant="subtle" :title="t('si.outside')" :description="outside" />
      <ProposalList :records="proposed" :dropped="dropped" @toggle="toggle" />
      <div class="flex flex-wrap items-center gap-3">
        <UCheckbox v-if="outside" v-model="outsideOk" :label="t('si.outsideOk')" />
        <UButton :loading="saving" :disabled="!kept.length || (!!outside && !outsideOk)" :label="t('si.create', { n: kept.length })" @click="create" />
      </div>
    </template>
    <p v-for="problem in problems" :key="problem" class="text-sm text-warning">{{ problem }}</p>
    <p v-if="created.length" class="text-sm">
      {{ t('si.created') }}
      <template v-for="(item, at) in created" :key="item.id">
        <NuxtLink :to="`/projects/${projectId}/records/${item.id}`" class="font-mono hover:underline">{{ item.id }}</NuxtLink><span v-if="at < created.length - 1">, </span>
      </template>
    </p>
  </UCard>
</template>
