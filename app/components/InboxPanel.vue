<script setup lang="ts">
// Вкладка «Входящее» экрана «Наполнение»: входящее и импорт на одном экране (docs/04-ui.md, «Навигация»).
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
  /** Разобранные — не исчезли, а переехали; видно, что из каждой выросло. */
  archived: { path: string; title: string; size: number; derived: string[] }[];
}

const showArchived = ref(false);

const { data, refresh } = useFetch<Inbox | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/inbox`,
  { key: () => `inbox:${projectId.value}` }
);

const failure = computed(() => failureOf(data.value));
const inbox = computed(() => (failure.value ? null : (data.value as Inbox | null)));

const noteTitle = ref('');
const noteBody = ref('');
const savingNote = ref(false);
const noteFailure = ref<ApiFailure | null>(null);

/**
 * Заметка от человека без markdown и файловой системы — та же дверь на склад,
 * что и у модели (docs/10-inbox.md, «Что кладёт человек»).
 */
async function saveNote() {
  savingNote.value = true;
  noteFailure.value = null;
  try {
    const response = await $fetch<{ path: string } | { error: ApiFailure }>(
      `/api/projects/${projectId.value}/inbox/notes`,
      { method: 'POST', body: { title: noteTitle.value, body: noteBody.value }, ignoreResponseError: true }
    );
    const problem = failureOf(response);
    if (problem) {
      noteFailure.value = problem;
      return;
    }
    noteTitle.value = '';
    noteBody.value = '';
    await refresh();
  } finally {
    savingNote.value = false;
  }
}

const chosen = ref<string[]>([]);
const proposed = ref<ProposedRecord[]>([]);
const dropped = ref<string[]>([]);
const created = ref<CreatedRecord[]>([]);
/** Что модель сказала словами: при пустом списке это и есть весь ответ. */
const said = ref('');
const problems = ref<string[]>([]);
/** Заметки, из которых модель заводить ничего не стала, и причина: принимаются без записей. */
const skipped = ref<{ note: string; why: string }[]>([]);
const accepting = ref(false);
const trouble = ref<ApiFailure | null>(null);
const saving = ref(false);

const { running, elapsed, outcome, log, stream, cancel } = useModelRequest(() => `${projectId.value}:inbox`, {
  label: 'Разбор входящего',
  onRecovered: (answer) => afterAnswer(answer as { answer: string })
});

/** Не выбрали ничего — разбираем всё: так чаще всего и нужно. */
const notes = computed(() => (chosen.value.length ? chosen.value : (inbox.value?.notes ?? []).map((note) => note.path)));

const kept = computed(() => proposed.value.filter((record) => !dropped.value.includes(record.key)));

function toggleNote(path: string) {
  chosen.value = chosen.value.includes(path)
    ? chosen.value.filter((item) => item !== path)
    : [...chosen.value, path];
}

/** Выбрать всё / снять всё над списком заметок: отмечается ровно то, что в списке. */
const allNotes = computed(() => (inbox.value?.notes ?? []).map((note) => note.path));
const notesState = computed<boolean | 'indeterminate'>(() => {
  if (chosen.value.length === 0) return false;
  return chosen.value.length === allNotes.value.length ? true : 'indeterminate';
});

function toggleAllNotes() {
  chosen.value = notesState.value === true ? [] : [...allNotes.value];
}

/** То же над предложенными записями: выключенные лежат в `dropped`. */
const recordsState = computed<boolean | 'indeterminate'>(() => {
  if (dropped.value.length === 0) return true;
  return dropped.value.length >= proposed.value.length ? false : 'indeterminate';
});

function toggleAllRecords() {
  dropped.value = recordsState.value === true ? proposed.value.map((record) => record.key) : [];
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
  skipped.value = [];
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
  await afterAnswer(answer);
}

/** Ответ модели разбирается в список здесь же: на месте или после возвращения на страницу. */
async function afterAnswer(answer: { answer: string }) {
  // Разбираем ответ здесь же, чтобы человек правил список, а не текст.
  const parsed = await $fetch<{ records: ProposedRecord[]; problems: string[]; skipped: { note: string; why: string }[] } | { error: ApiFailure }>(
    `/api/projects/${projectId.value}/inbox/preview`,
    { method: 'POST', body: { answer: answer.answer }, ignoreResponseError: true }
  );
  const broken = failureOf(parsed);
  if (broken) {
    trouble.value = broken;
    return;
  }

  const result = parsed as { records: ProposedRecord[]; problems: string[]; skipped: { note: string; why: string }[] };
  proposed.value = result.records;
  skipped.value = result.skipped ?? [];
  problems.value = result.problems;
  said.value = answer.answer;
}

/** «Принять без записей»: решение человека, а не модели (docs/10-inbox.md). */
async function acceptSkipped() {
  accepting.value = true;
  trouble.value = null;
  try {
    const response = await $fetch<{ accepted: string[]; problems: string[] } | { error: ApiFailure }>(
      `/api/projects/${projectId.value}/inbox/accept`,
      { method: 'POST', body: { notes: skipped.value.map((item) => item.note) }, ignoreResponseError: true }
    );
    const problem = failureOf(response);
    if (problem) {
      trouble.value = problem;
      return;
    }
    problems.value = (response as { problems: string[] }).problems;
    skipped.value = [];
    await refresh();
  } finally {
    accepting.value = false;
  }
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
        <h2 class="text-lg font-semibold">Входящее</h2>
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

        <UCard>
          <template #header>
            <h2 class="font-medium">Записать наработку</h2>
          </template>
          <p class="mb-3 text-sm text-muted">
            Обычным текстом, без markdown и файлов — заголовок и суть. Приложение само
            положит заметку на склад, дальше с ней работают так же, как с любой другой.
          </p>
          <div class="space-y-3">
            <UInput v-model="noteTitle" placeholder="Заголовок" size="lg" class="w-full" />
            <UTextarea v-model="noteBody" placeholder="Что заметили, что нужно, как должно работать…" :rows="4" autoresize class="w-full" />
            <UButton :loading="savingNote" :disabled="!noteTitle.trim() || !noteBody.trim()" @click="saveNote">
              Сохранить заметку
            </UButton>
          </div>
          <UAlert
            v-if="noteFailure"
            class="mt-3"
            color="error"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            :title="noteFailure.message"
          />
        </UCard>

        <div v-if="inbox.notes.length === 0" class="rounded border border-default p-3 text-sm">
          Заметок пока нет. Запишите наработку формой выше, или положите файл <code>.md</code>
          руками — по одной теме на файл; запрос для модели лежит в <code>docs/prompts/inbox.md</code>.
        </div>

        <template v-else>
          <UCheckbox
            class="px-2"
            :model-value="notesState"
            label="Выбрать всё"
            @update:model-value="toggleAllNotes"
          />

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
          <!-- Модель назвала заметки, из которых заводить нечего: человек принимает их без записей. -->
          <div v-if="skipped.length" class="mt-3 space-y-2 border-t border-default pt-3">
            <p class="text-sm font-medium">Заводить нечего:</p>
            <ul class="space-y-1 text-sm">
              <li v-for="item in skipped" :key="item.note"><span class="font-mono text-xs">{{ item.note }}</span> — {{ item.why }}</li>
            </ul>
            <UButton size="sm" variant="soft" :loading="accepting" @click="acceptSkipped">Принять без записей</UButton>
            <p class="text-xs text-muted">Заметки переедут в «принятое»; записей не появится.</p>
          </div>
        </div>

        <template v-if="proposed.length">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-medium">Предложено записей: {{ proposed.length }}</h2>
            <UBadge v-if="dropped.length" color="neutral" variant="subtle">выключено {{ dropped.length }}</UBadge>
          </div>

          <UCheckbox
            :model-value="recordsState"
            label="Выбрать всё"
            @update:model-value="toggleAllRecords"
          />

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

              <!-- Только у карт: возможности, которые запись предложит в функциональную
                   карту (docs/06-phases.md, фаза 12) — человек должен увидеть их до
                   заведения, а не только текст блока внутри готовой записи. -->
              <ul v-if="record.capabilities && record.capabilities.length" class="mt-2 space-y-0.5 text-sm">
                <li v-for="cap in record.capabilities" :key="cap.id" class="font-mono text-xs text-muted">
                  {{ cap.parent ? `↳ ${cap.parent} · ` : '' }}{{ cap.title || cap.id }}
                </li>
              </ul>

              <p v-if="record.links && Object.keys(record.links).length" class="mt-2 font-mono text-xs text-muted">
                <span v-for="(values, kind) in record.links" :key="kind">{{ kind }}: {{ values.join(', ') }} </span>
              </p>

              <p v-if="record.notes && record.notes.length" class="mt-2 font-mono text-xs text-muted">
                из: {{ record.notes.join(', ') }}
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

        <!-- Разобранное не исчезает: находится и через месяц, видно, что выросло
             (docs/06-phases.md, фаза 11). Свёрнуто по умолчанию — это история,
             а не то, ради чего экран открывают каждый раз. -->
        <div v-if="inbox.archived.length">
          <UButton
            size="sm"
            variant="ghost"
            color="neutral"
            :icon="showArchived ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
            @click="showArchived = !showArchived"
          >
            Разобранное: {{ inbox.archived.length }}
          </UButton>

          <ul v-if="showArchived" class="mt-2 space-y-2">
            <li v-for="note in inbox.archived" :key="note.path" class="rounded border border-default p-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="font-medium">{{ note.title }}</span>
                <span class="font-mono text-xs text-muted">{{ note.path }}</span>
              </div>
              <p class="mt-1 text-xs text-muted">
                <template v-if="note.derived.length">
                  выросло:
                  <NuxtLink
                    v-for="id in note.derived"
                    :key="id"
                    :to="`/projects/${projectId}/records/${id}`"
                    class="ml-1 font-mono hover:underline"
                  >{{ id }}</NuxtLink>
                </template>
                <template v-else>ни одна запись явно не назвала эту заметку своим источником</template>
              </p>
            </li>
          </ul>
        </div>
      </template>
    </template>
  </div>
</template>
