<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { withSessionNote, type GrillMode, type GrillQuestion, type GrillSession } from '~~/server/lib/grill';

/**
 * Допрос проекта (R-0114, R-0115, docs/08-usage.md): модель расспрашивает, ответы дословно ложатся
 * в файл сессии, итог раскладывается в черновики. Состояние — на сервере: обновление страницы
 * возвращает на тот же вопрос. Текст ответа пока не отправлен, живёт только в этом экземпляре.
 */
const props = defineProps<{ projectId: string; mode: GrillMode }>();
const emit = defineEmits<{ created: [] }>();
const { t } = useT();

interface View { path: string; session: GrillSession; waiting: GrillQuestion[]; open: GrillQuestion[]; pending: string[]; problem?: string }

const view = ref<View | null>(null);
const drafts = reactive<Record<string, string>>({});
const failure = ref<ApiFailure | null>(null);
const opened = ref(false);
const THEME_COUNT = 11;

const { data: llm } = useLazyFetch<{ available: boolean; reason: string | null }>('/api/llm', { key: 'llm' });
const proposal = useProposal(() => props.projectId);
const { proposed, dropped, problems, created, outside, outsideOk, saving, kept } = proposal;

const asking = useModelRequest(() => `${props.projectId}:grill`, {
  label: t('gr.label'),
  onRecovered: (reply) => { view.value = reply as View; }
});
const planning = useModelRequest(() => `${props.projectId}:grill-plan`, {
  label: t('gr.planLabel'),
  onRecovered: (answer) => void proposal.preview((answer as { answer: string }).answer)
});
const busy = computed(() => asking.running.value || planning.running.value);

const done = computed(() => view.value?.session.status === 'done');
const covered = computed(() => THEME_COUNT - (view.value?.pending.length ?? THEME_COUNT));
const answered = computed(() => (view.value?.session.questions ?? []).filter((question) => question.answer !== undefined && !question.open));
const canAsk = computed(() => !!llm.value?.available && !busy.value);
const themeName = (id: string) => t(`gr.theme.${id}`);

async function load() {
  const reply = await $fetch<{ view: View | null } | { error: ApiFailure }>(`/api/projects/${props.projectId}/grill`, { ignoreResponseError: true });
  if (failureOf(reply)) { failure.value = failureOf(reply); return; }
  view.value = (reply as { view: View | null }).view;
  if (view.value) opened.value = true;
}
onMounted(load);

function collected() {
  return Object.entries(drafts).filter(([, text]) => text.trim()).map(([id, text]) => ({ id, text }));
}

async function step(action: 'start' | 'answer' | 'finish') {
  failure.value = null;
  opened.value = true;
  const answers = collected();
  const reply = await asking.stream<View>(`/api/projects/${props.projectId}/grill`, {
    action,
    answers,
    ...(action === 'start' ? { mode: props.mode } : { path: view.value?.path })
  });
  // Ответы уже в файле, даже если модель подвела: черновики больше не нужны, картина — из файла.
  for (const answer of answers) drafts[answer.id] = '';
  if (reply) view.value = reply;
  else await load();
}

function dontKnow(id: string) {
  drafts[id] = t('gr.dontKnowText');
}

async function layout() {
  if (!view.value) return;
  proposal.reset();
  const built = await $fetch<{ prompt: string } | { error: ApiFailure }>(`/api/projects/${props.projectId}/prompt`, {
    method: 'POST', body: { kind: 'inbox', notes: [view.value.path], mode: 'grill' }, ignoreResponseError: true
  });
  if (failureOf(built)) { proposal.trouble.value = failureOf(built); return; }
  const answer = await planning.stream<{ answer: string }>('/api/llm/ask', { prompt: (built as { prompt: string }).prompt, projectId: props.projectId });
  if (answer) await proposal.preview(answer.answer);
}

async function createRecords() {
  if (!view.value) return;
  const ok = await proposal.create(withSessionNote(kept.value, view.value.path), [view.value.path]);
  if (!ok) return;
  emit('created');
  await load();
}
</script>

<template>
  <UCard :ui="{ body: 'space-y-4' }">
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <UIcon name="i-lucide-messages-square" class="size-5 text-primary" />
        <h2 class="font-medium">{{ t('gr.title') }}</h2>
        <UBadge v-if="view" variant="soft" color="neutral">{{ t('gr.covered', { n: covered, total: THEME_COUNT }) }}</UBadge>
        <UBadge v-if="done" variant="soft" color="success">{{ t('gr.finished') }}</UBadge>
      </div>
    </template>

    <p class="text-sm text-muted">{{ mode === 'new' ? t('gr.hintNew') : t('gr.hintExisting') }}</p>

    <div v-if="!view || !opened" class="flex flex-wrap items-center gap-3">
      <UButton v-can="'edit_draft'" icon="i-lucide-play" :loading="asking.running.value" :disabled="!canAsk" :label="t('gr.start')" @click="step('start')" />
      <!-- Недоступное действие обязано назвать причину (docs/04-ui.md). -->
      <p v-if="llm && !llm.available" class="min-w-0 flex-1 text-sm text-muted">{{ llm.reason }}</p>
    </div>

    <ModelProgress :running="asking.running.value" :elapsed="asking.elapsed.value" :outcome="asking.outcome.value" @cancel="asking.cancel" />
    <ModelLog :lines="asking.log.value" :running="asking.running.value" />
    <UAlert v-if="failure" color="error" variant="subtle" :title="failure.message" />

    <template v-if="view && opened">
      <div v-if="view.problem || (!done && !view.waiting.length && !asking.running.value)" class="flex flex-wrap items-center gap-3">
        <UAlert v-if="view.problem" color="warning" variant="subtle" class="w-full" :title="t('gr.badReply')" :description="view.problem" />
        <UButton icon="i-lucide-refresh-cw" :disabled="!canAsk" :label="t('gr.askAgain')" @click="step('answer')" />
        <p v-if="llm && !llm.available" class="min-w-0 flex-1 text-sm text-muted">{{ llm.reason }}</p>
      </div>

      <section v-if="view.waiting.length" class="space-y-3">
        <UFormField v-for="question in view.waiting" :key="question.id" :label="question.text" :help="themeName(question.theme)">
          <UTextarea v-model="drafts[question.id]" :rows="2" autoresize class="w-full" />
          <UButton class="mt-1" size="xs" variant="ghost" color="neutral" :label="t('gr.dontKnow')" @click="dontKnow(question.id)" />
        </UFormField>
      </section>

      <div v-if="!done" class="flex flex-wrap items-center gap-3">
        <UButton v-if="view.waiting.length" icon="i-lucide-send" :disabled="busy || !collected().length" :label="t('gr.answer')" @click="step('answer')" />
        <UButton variant="soft" color="neutral" icon="i-lucide-flag" :disabled="busy" :label="t('gr.finish')" @click="step('finish')" />
        <span v-if="view.pending.length" class="text-xs text-muted">{{ t('gr.pending') }}: {{ view.pending.map(themeName).join(', ') }}</span>
      </div>

      <section v-if="view.open.length" class="space-y-2">
        <h3 class="text-sm font-medium">{{ t('gr.openHead', { n: view.open.length }) }}</h3>
        <UFormField v-for="question in view.open" :key="question.id" :label="question.text" :help="themeName(question.theme)">
          <UTextarea v-model="drafts[question.id]" :rows="1" autoresize class="w-full" :placeholder="t('gr.openHint')" />
        </UFormField>
        <UButton v-if="done" size="sm" variant="soft" :disabled="busy || !collected().length" :label="t('gr.saveOpen')" @click="step('answer')" />
      </section>

      <details v-if="answered.length" class="text-sm">
        <summary class="cursor-pointer text-muted">{{ t('gr.saidHead', { n: answered.length }) }}</summary>
        <dl class="mt-2 space-y-2">
          <div v-for="question in answered" :key="question.id">
            <dt class="font-medium">{{ question.text }}</dt>
            <dd class="whitespace-pre-wrap text-muted">{{ question.answer }}</dd>
          </div>
        </dl>
      </details>

      <section v-if="done" class="space-y-3 border-t border-default pt-4">
        <p class="text-sm text-muted">{{ t('gr.planHint') }}</p>
        <div class="flex flex-wrap items-center gap-3">
          <UButton icon="i-lucide-sparkles" :loading="planning.running.value" :disabled="!canAsk" :label="t('gr.plan')" @click="layout" />
          <p v-if="llm && !llm.available" class="min-w-0 flex-1 text-sm text-muted">{{ llm.reason }}</p>
        </div>
        <ModelProgress :running="planning.running.value" :elapsed="planning.elapsed.value" :outcome="planning.outcome.value" @cancel="planning.cancel" />
        <ModelLog :lines="planning.log.value" :running="planning.running.value" />
        <template v-if="proposed.length">
          <UAlert v-if="outside" color="warning" variant="subtle" :title="t('si.outside')" :description="outside" />
          <ProposalList :records="proposed" :dropped="dropped" @toggle="proposal.toggle" />
          <div class="flex flex-wrap items-center gap-3">
            <UCheckbox v-if="outside" v-model="outsideOk" :label="t('si.outsideOk')" />
            <UButton :loading="saving" :disabled="!kept.length || (!!outside && !outsideOk)" :label="t('si.create', { n: kept.length })" @click="createRecords" />
          </div>
        </template>
      </section>
    </template>

    <UAlert v-if="proposal.trouble.value" color="error" variant="subtle" :title="proposal.trouble.value.message" />
    <p v-for="problem in problems" :key="problem" class="text-sm text-warning">{{ problem }}</p>
    <p v-if="created.length" class="text-sm">
      {{ t('si.created') }}
      <template v-for="(item, at) in created" :key="item.id">
        <NuxtLink :to="`/projects/${projectId}/records/${item.id}`" class="font-mono hover:underline">{{ item.id }}</NuxtLink><span v-if="at < created.length - 1">, </span>
      </template>
    </p>
  </UCard>
</template>
