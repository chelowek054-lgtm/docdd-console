<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { CreatedRecord } from '~~/server/utils/inbox-service';
import type { ProposedRecord } from '~~/server/lib/inbox';

/**
 * Входящее: сырые заметки и заведение записей по ним (docs/10-inbox.md).
 * Записи создаёт приложение — модель только предлагает список, а человек его
 * правит и подтверждает.
 */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

interface Inbox {
  folders: string[];
  notes: { path: string; title: string; size: number }[];
}

const { data, refresh } = useFetch<Inbox | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/inbox`,
  { key: () => `inbox:${projectId.value}` }
);

const failure = computed(() => failureOf(data.value));
const inbox = computed(() => (failure.value ? null : (data.value as Inbox | null)));

const chosen = ref<string[]>([]);
const proposed = ref<ProposedRecord[]>([]);
const dropped = ref<string[]>([]);
const created = ref<CreatedRecord[]>([]);
/** Что модель сказала словами: при пустом списке это и есть весь ответ. */
const said = ref('');
const problems = ref<string[]>([]);
const trouble = ref<ApiFailure | null>(null);
const saving = ref(false);

const { running, elapsed, outcome, log, stream, cancel } = useModelRequest();

/** Не выбрали ничего — разбираем всё: так чаще всего и нужно. */
const notes = computed(() => (chosen.value.length ? chosen.value : (inbox.value?.notes ?? []).map((note) => note.path)));

const kept = computed(() => proposed.value.filter((record) => !dropped.value.includes(record.key)));

function toggleNote(path: string) {
  chosen.value = chosen.value.includes(path)
    ? chosen.value.filter((item) => item !== path)
    : [...chosen.value, path];
}

function toggleRecord(key: string) {
  dropped.value = dropped.value.includes(key)
    ? dropped.value.filter((item) => item !== key)
    : [...dropped.value, key];
}

async function analyse() {
  trouble.value = null;
  proposed.value = [];
  created.value = [];
  problems.value = [];
  said.value = '';

  const built = await $fetch<{ prompt: string } | { error: ApiFailure }>(
    `/api/projects/${projectId.value}/prompt`,
    { method: 'POST', body: { kind: 'inbox', notes: notes.value }, ignoreResponseError: true }
  );
  const problem = failureOf(built);
  if (problem) {
    trouble.value = problem;
    return;
  }

  const answer = await stream<{ answer: string }>('/api/llm/ask', {
    prompt: (built as { prompt: string }).prompt,
    projectId: projectId.value
  });
  if (!answer) return;

  // Разбираем ответ здесь же, чтобы человек правил список, а не текст.
  const parsed = await $fetch<{ records: ProposedRecord[]; problems: string[] } | { error: ApiFailure }>(
    `/api/projects/${projectId.value}/inbox/preview`,
    { method: 'POST', body: { answer: answer.answer }, ignoreResponseError: true }
  );
  const broken = failureOf(parsed);
  if (broken) {
    trouble.value = broken;
    return;
  }

  const result = parsed as { records: ProposedRecord[]; problems: string[] };
  proposed.value = result.records;
  problems.value = result.problems;
  said.value = answer.answer;
}

async function create() {
  saving.value = true;
  trouble.value = null;
  try {
    const response = await $fetch<{ created: CreatedRecord[]; problems: string[] } | { error: ApiFailure }>(
      `/api/projects/${projectId.value}/inbox/records`,
      { method: 'POST', body: { records: kept.value, notes: notes.value }, ignoreResponseError: true }
    );
    const problem = failureOf(response);
    if (problem) {
      trouble.value = problem;
      return;
    }

    const result = response as { created: CreatedRecord[]; problems: string[] };
    created.value = result.created;
    problems.value = result.problems;
    proposed.value = [];
    await refresh();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Входящее</h1>
        <UBadge v-if="inbox?.notes.length" variant="subtle">{{ inbox.notes.length }} заметок</UBadge>
      </div>

      <!-- Склад не назван — это состояние, и оно объясняется словами. -->
      <UAlert
        v-if="inbox && inbox.folders.length === 0"
        color="neutral"
        variant="subtle"
        icon="i-lucide-inbox"
        title="Склад сырых заметок не назван"
        description="Впишите в манифест sources.inbox — например [docs/inbox]. Разбирать записи из папки, о которой приложение не знает, оно не станет."
      />

      <template v-else-if="inbox">
        <p class="text-sm text-muted">
          Сырые заметки лежат в {{ inbox.folders.join(', ') }} — снаружи <code>docs/development</code>:
          там схема, и сырой текст дал бы ошибку разбора. Разобранное переезжает в <code>принятое</code>.
        </p>

        <div v-if="inbox.notes.length === 0" class="rounded border border-default p-3 text-sm">
          Заметок нет. Положите их файлами <code>.md</code> — по одной теме на файл; запрос для модели
          лежит в <code>docs/prompts/inbox.md</code>.
        </div>

        <template v-else>
          <ul class="space-y-1">
            <li v-for="note in inbox.notes" :key="note.path">
              <button
                type="button"
                class="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm hover:bg-elevated"
                @click="toggleNote(note.path)"
              >
                <UIcon
                  :name="chosen.includes(note.path) ? 'i-lucide-check-square' : 'i-lucide-square'"
                  class="text-muted"
                />
                <span class="font-medium">{{ note.title }}</span>
                <span class="font-mono text-xs text-muted">{{ note.path }}</span>
              </button>
            </li>
          </ul>

          <div class="flex flex-wrap items-center gap-3">
            <UButton v-if="!running" icon="i-lucide-wand-sparkles" @click="analyse">Разобрать входящее</UButton>
            <p v-if="!running" class="text-sm text-muted">
              {{ chosen.length ? `Выбрано заметок: ${chosen.length}` : 'Не выбрано ничего — разберём все' }}.
              Модель предложит список; заводить будете вы.
            </p>
          </div>
        </template>

        <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome" @cancel="cancel" />
        <ModelLog :lines="log" :running="running" />

        <UAlert
          v-if="trouble"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="trouble.message"
          :description="(trouble.blockers ?? []).map((blocker) => blocker.message).join(' ') || trouble.detail"
        />

        <!-- Модель вправе сказать, что заводить нечего: это ответ, а не сбой. -->
        <div v-if="said && !proposed.length && !running" class="rounded border border-default p-3">
          <p class="mb-2 text-sm font-medium">Модель не нашла, что заводить</p>
          <DocumentText :body="said" />
        </div>

        <template v-if="proposed.length">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-medium">Предложено записей: {{ proposed.length }}</h2>
            <UBadge v-if="dropped.length" color="neutral" variant="subtle">выключено {{ dropped.length }}</UBadge>
          </div>

          <ul class="space-y-2">
            <li
              v-for="record in proposed"
              :key="record.key"
              class="rounded border border-default p-3"
              :class="dropped.includes(record.key) ? 'opacity-50' : ''"
            >
              <button
                type="button"
                class="flex w-full items-center gap-2 text-left"
                @click="toggleRecord(record.key)"
              >
                <UIcon
                  :name="dropped.includes(record.key) ? 'i-lucide-square' : 'i-lucide-check-square'"
                  class="text-muted"
                />
                <UBadge variant="subtle">{{ typeLabel(record.type) }}</UBadge>
                <span class="font-medium">{{ record.title }}</span>
              </button>

              <p v-if="record.body" class="mt-2 whitespace-pre-wrap text-sm text-muted">{{ record.body }}</p>

              <p v-if="record.links && Object.keys(record.links).length" class="mt-2 font-mono text-xs text-muted">
                <span v-for="(values, kind) in record.links" :key="kind">{{ kind }}: {{ values.join(', ') }} </span>
              </p>
            </li>
          </ul>

          <div class="flex flex-wrap items-center gap-3">
            <UButton color="primary" :loading="saving" :disabled="kept.length === 0" @click="create">
              Завести записи: {{ kept.length }}
            </UButton>
            <p class="text-sm text-muted">
              Все заведённые — черновики. Подтверждать их всё равно вам, по одной.
            </p>
          </div>
        </template>

        <template v-if="created.length">
          <h2 class="font-medium">Заведено</h2>
          <ul class="space-y-1 text-sm">
            <li v-for="record in created" :key="record.id">
              <NuxtLink :to="`/projects/${projectId}/records/${record.id}`" class="hover:underline">
                <span class="font-mono">{{ record.id }}</span> — {{ record.title }}
              </NuxtLink>
            </li>
          </ul>
        </template>

        <UAlert
          v-if="problems.length"
          color="warning"
          variant="subtle"
          icon="i-lucide-info"
          title="Не всё сошлось"
          :description="problems.join(' ')"
        />
      </template>
    </template>
  </div>
</template>
