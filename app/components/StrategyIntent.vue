<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ProposedRecord } from '~~/server/lib/inbox';
import { offVector } from '~~/server/lib/prompt';

/**
 * Строка намерения на стратегической карте (docs/adr/0037-strategy-intent-input.md): фраза
 * становится заметкой во входящем, разбирается тем же `inbox-plan` в режиме «стратегия» и
 * приходит предложением — возможность, требования, проверки, задачи. Заводятся черновики.
 */
const props = defineProps<{ projectId: string; contours: readonly { id: string; title: string }[] }>();
const emit = defineEmits<{ created: [] }>();
const { t } = useT();

const text = ref('');
/** Значение «контур выберет модель»: у списка Nuxt UI пустого значения быть не может. */
const ANY = '__any__';
const contour = ref(ANY);
const proposed = ref<ProposedRecord[]>([]);
const dropped = ref<string[]>([]);
const problems = ref<string[]>([]);
const created = ref<{ id: string; title: string }[]>([]);
const outside = ref<string | null>(null);
const outsideOk = ref(false);
const trouble = ref<ApiFailure | null>(null);
const saving = ref(false);

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
  onRecovered: (answer) => void afterAnswer(answer as { answer: string })
});

const ORDER = ['map', 'requirement', 'verification', 'task'];
const rank = (type: string) => (ORDER.includes(type) ? ORDER.indexOf(type) : ORDER.length);
const sorted = computed(() => [...proposed.value].sort((a, b) => rank(a.type) - rank(b.type)));
const kept = computed(() => proposed.value.filter((record) => !dropped.value.includes(record.key)));

function failed(value: unknown): ApiFailure | null {
  return value && typeof value === 'object' && 'error' in value ? (value as { error: ApiFailure }).error : null;
}

async function run() {
  trouble.value = null; proposed.value = []; dropped.value = []; problems.value = []; created.value = [];
  outside.value = null; outsideOk.value = false;
  const intent = text.value.trim();
  if (!intent) return;
  const note = await $fetch<{ path: string } | { error: ApiFailure }>(`/api/projects/${props.projectId}/inbox/notes`, {
    method: 'POST', body: { title: intent.split(/\r?\n/, 1)[0]!.slice(0, 80), body: intent }, ignoreResponseError: true
  });
  if (failed(note)) { trouble.value = failed(note); return; }
  const path = (note as { path: string }).path;
  rememberNote(path);
  const built = await $fetch<{ prompt: string } | { error: ApiFailure }>(`/api/projects/${props.projectId}/prompt`, {
    method: 'POST', body: { kind: 'inbox', notes: [path], mode: 'strategy', contour: contour.value === ANY ? undefined : contour.value }, ignoreResponseError: true
  });
  if (failed(built)) { trouble.value = failed(built); return; }
  const answer = await stream<{ answer: string }>('/api/llm/ask', { prompt: (built as { prompt: string }).prompt, projectId: props.projectId });
  if (answer) await afterAnswer(answer);
}

async function afterAnswer(answer: { answer: string }) {
  outside.value = offVector(answer.answer);
  const parsed = await $fetch<{ records: ProposedRecord[]; problems: string[] } | { error: ApiFailure }>(`/api/projects/${props.projectId}/inbox/preview`, {
    method: 'POST', body: { answer: answer.answer }, ignoreResponseError: true
  });
  if (failed(parsed)) { trouble.value = failed(parsed); return; }
  const result = parsed as { records: ProposedRecord[]; problems: string[] };
  proposed.value = result.records;
  problems.value = result.problems;
}

async function create() {
  const path = notePath();
  saving.value = true; trouble.value = null;
  try {
    const response = await $fetch<{ created: { id: string; title: string }[]; problems: string[] } | { error: ApiFailure }>(`/api/projects/${props.projectId}/inbox/records`, {
      method: 'POST', body: { records: kept.value, notes: path ? [path] : [] }, ignoreResponseError: true
    });
    if (failed(response)) { trouble.value = failed(response); return; }
    const result = response as { created: { id: string; title: string }[]; problems: string[] };
    created.value = result.created; problems.value = result.problems; proposed.value = [];
    text.value = ''; rememberNote(null);
    emit('created');
  } finally {
    saving.value = false;
  }
}

function toggle(key: string) {
  dropped.value = dropped.value.includes(key) ? dropped.value.filter((item) => item !== key) : [...dropped.value, key];
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
      <UButton icon="i-lucide-sparkles" :loading="running" :disabled="!text.trim() || running" :label="t('si.run')" @click="run" />
    </div>
    <p class="text-xs text-muted">{{ t('si.hint') }}</p>

    <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
    <ModelLog :lines="log" :running="running" />
    <UAlert v-if="trouble" color="error" variant="subtle" :title="trouble.message" />

    <template v-if="proposed.length">
      <UAlert v-if="outside" color="warning" variant="subtle" :title="t('si.outside')" :description="outside" />
      <ul class="space-y-1 text-sm">
        <li v-for="record in sorted" :key="record.key" class="flex items-start gap-2" :class="record.type === 'map' ? '' : record.type === 'task' ? 'pl-8' : 'pl-4'">
          <UCheckbox :model-value="!dropped.includes(record.key)" @update:model-value="toggle(record.key)" />
          <UBadge size="sm" variant="subtle" color="neutral">{{ t(`si.type.${record.type}`) }}</UBadge>
          <span>{{ record.title }}</span>
        </li>
      </ul>
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
