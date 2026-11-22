<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { reviewerOf } from '~~/server/lib/reviewer';
import type { IndexRecord } from '~~/server/lib/types';
import { parseCheckSteps } from '~~/server/lib/manual-report';

/**
 * «Принять вручную» (docs/04-ui.md): отметка «Проверено» на ручных проверках
 * и повторный перевод задач. Окно само находит, чего не хватает задаче, —
 * по цепочке задача → требование → проверка. Автоматические проверки принимаются
 * так же, но с пометкой «прогона сборки не было» (ADR-0029).
 */
const props = defineProps<{
  projectId: string;
  /** Задачи, которые надо закрыть; их проверки окно находит само. */
  taskIds?: string[];
  /** Режим проверки (флажок «Проверено»): отметка, а задачи её требований — по флажкам. */
  verificationIds?: string[];
  roles: { id: string; name: string }[];
}>();

const emit = defineEmits<{ changed: [] }>();
const open = defineModel<boolean>('open', { default: false });

const { index, byId, refresh } = useProjectIndex(() => props.projectId);

const MANUAL = ['manual', 'review']; const { t } = useT();
const isManual = (record: IndexRecord) => MANUAL.includes(String(record.extra['kind'] ?? ''));
/** У автоматических видов приёмка честно помечена: прогона сборки не было (ADR-0029). */
const kindNote = (record: IndexRecord) => isManual(record) ? '' : t('ma.kindNote', { kind: String(record.extra['kind'] ?? t('ma.noKind')) });

const tasks = computed(() => (props.taskIds ?? []).map((id) => byId.value.get(id)).filter((r): r is IndexRecord => !!r));

/** Непройденные проверки в целевом наборе: из задач — по требованиям, из режима проверки — как есть. */
const pending = computed<IndexRecord[]>(() => {
  const results = index.value?.verificationResults ?? {};
  const ids = new Set<string>(props.verificationIds ?? []);
  for (const task of tasks.value) for (const id of taskCheckIds(task, index.value?.records ?? [], byId.value)) ids.add(id);
  return [...ids]
    .map((id) => byId.value.get(id))
    .filter((r): r is IndexRecord => !!r && results[r.id]?.state !== 'passed');
});
const manual = pending;

/**
 * Задачи без единой проверки (R-0135): окно заводит ручную проверку к требованию задачи
 * (или к самой задаче, если требования нет), подтверждает её, отмечает «Проверено» и закрывает задачу.
 */
const bare = computed(() => (props.verificationIds?.length ? [] : tasks.value.filter((task) =>
  task.status === 'in_review' && taskCheckIds(task, index.value?.records ?? [], byId.value).length === 0)));
const fillable = computed(() => manual.value.length > 0 || bare.value.length > 0);

/**
 * Проверка относится к требованию, а не к задаче: отметка снимет блокировку и с других задач
 * этого требования. Закрыть можно только те, что «на проверке» (в done ведёт лишь in_review);
 * остальные называем, чтобы было видно: требование реализовано не полностью.
 */
const sharedTasks = computed<IndexRecord[]>(() => {
  const own = new Set(props.taskIds ?? []);
  const targets = new Set(manual.value.flatMap((check) => check.links.verifies ?? []));
  return (index.value?.records ?? []).filter((record) =>
    record.type === 'task'
    && !own.has(record.id)
    && !['done', 'dropped'].includes(record.status)
    && (record.links.implements ?? []).some((target) => targets.has(target)));
});
const closable = computed(() => sharedTasks.value.filter((record) => record.status === 'in_review'));
const notReady = computed(() => sharedTasks.value.filter((record) => record.status !== 'in_review'));
/** Храним снятые флажки, а не поставленные: задачи на проверке закрываются по умолчанию. */
const skipped = ref<string[]>([]);
const alsoClose = computed(() => closable.value.filter((record) => !skipped.value.includes(record.id)));

const actor = ref(props.roles[0]?.id ?? ''); const { me } = useMe(() => props.projectId);
const by = ref('');
const note = ref('');
const confirmed = ref(false);
const busy = ref(false);

interface Line { id: string; ok: boolean; text: string }
const outcome = ref<Line[] | null>(null);

// Шаги проверок (R-0061) берутся из тела записи; у проверки без шагов окно прежнее.
interface StepView { text: string; expected?: string }
const stepsOf = ref<Record<string, StepView[]>>({});
const failedSteps = ref<Record<string, number[]>>({});
watch(() => manual.value.map((check) => check.id).join(','), async () => {
  for (const check of manual.value) {
    if (stepsOf.value[check.id]) continue;
    const detail = await $fetch<{ body?: string }>(`/api/projects/${props.projectId}/records/${check.id}`, { ignoreResponseError: true }).catch(() => null);
    stepsOf.value = { ...stepsOf.value, [check.id]: parseCheckSteps(detail?.body ?? '') };
  }
}, { immediate: true });

const noteProblem = computed(() => {
  if (note.value.trim().length > 300) return t('ma.note300');
  if (note.value.trim().split('\n').length > 2) return t('ma.note2');
  return '';
});
const byProblem = computed(() => (by.value.trim().length > 80 ? t('ma.by80') : ''));
const canAccept = computed(() =>
  fillable.value && by.value.trim() !== '' && note.value.trim() !== ''
  && confirmed.value && !noteProblem.value && !byProblem.value && !busy.value && outcome.value === null);

function reason(response: unknown): string | null {
  const error = (response as { error?: ApiFailure } | null)?.error;
  if (!error) return null;
  return [error.message, ...(error.blockers ?? []).map((blocker) => blocker.message)].join(' ');
}

async function accept() {
  busy.value = true;
  const lines: Line[] = [];
  try {
    const created: IndexRecord[] = [];
    // Задача без проверок закрывается, только если её новая проверка заведена и отмечена.
    const held = new Set<string>();
    const createdFor = new Map<string, string>();
    for (const task of bare.value) {
      const made = await createManualCheck(task);
      if ('record' in made) { created.push(made.record); createdFor.set(made.record.id, task.id); }
      else { held.add(task.id); lines.push({ id: task.id, ok: false, text: made.problem }); }
    }
    for (const check of [...manual.value, ...created]) {
      const response = await $fetch<unknown>(`/api/projects/${props.projectId}/records/${check.id}/verified`, {
        method: 'POST',
        body: {
          verified: true, actor: actor.value, by: by.value.trim(), note: note.value.trim(),
          steps: (stepsOf.value[check.id] ?? []).map((_, i) => ((failedSteps.value[check.id] ?? []).includes(i) ? 'failed' : 'passed'))
        },
        ignoreResponseError: true
      });
      const problem = reason(response);
      if (problem && createdFor.has(check.id)) held.add(createdFor.get(check.id) ?? '');
      lines.push({ id: check.id, ok: !problem, text: problem ?? t('ma.marked') });
    }
    for (const task of [...tasks.value, ...alsoClose.value].filter((item) => !held.has(item.id))) {
      const response = await $fetch<unknown>(`/api/projects/${props.projectId}/records/${task.id}/status`, {
        method: 'POST',
        body: { status: 'done', actor: actor.value, version: task.version },
        ignoreResponseError: true
      });
      const problem = reason(response);
      lines.push({ id: task.id, ok: !problem, text: problem ?? t('ma.done') });
    }
    outcome.value = lines;
    await refresh();
    emit('changed');
  } finally {
    busy.value = false;
  }
}

/** Заводит и подтверждает проверку `manual`: отметка «Проверено» ставится дальше общим путём. */
async function createManualCheck(task: IndexRecord): Promise<{ record: IndexRecord } | { problem: string }> {
  const target = task.links.implements?.[0] ?? task.id;
  const response = await $fetch<{ record?: IndexRecord } | { error: ApiFailure }>(`/api/projects/${props.projectId}/records`, {
    method: 'POST',
    body: { type: 'verification', kind: 'manual', title: t('ma.bareTitle', { title: task.title }), links: { verifies: [target] } },
    ignoreResponseError: true
  });
  const record = (response as { record?: IndexRecord }).record;
  if (reason(response) || !record) return { problem: reason(response) ?? t('ma.bareFailed') };
  // Черновик подтверждается через «на подтверждении»: прямого draft → approved у проверки нет.
  for (const status of ['review', 'approved']) {
    const moved = await $fetch<unknown>(`/api/projects/${props.projectId}/records/${record.id}/status`, {
      method: 'POST', body: { status, actor: actor.value }, ignoreResponseError: true
    });
    const problem = reason(moved);
    if (problem) return { problem: `${record.id}: ${problem}` };
  }
  return { record };
}

// Окно открывают заново на других записях: прежний итог и поля не тянем.
watch(open, (value) => {
  if (!value) return;
  outcome.value = null;
  skipped.value = [];
  // «Кто принял» — ревьюер задачи (adr/0030), если такая роль есть; иначе прежний выбор.
  const first = tasks.value[0] ?? closable.value[0];
  const role = first ? reviewerOf(first, index.value?.records ?? [], props.roles)?.role : undefined;
  if (role && props.roles.some((item) => item.id === role)) actor.value = role;
  confirmed.value = false;
  by.value = '';
  note.value = '';
});
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('ma.title')"
    :description="t('ma.desc')"
  >
    <template #body>
      <div class="space-y-4 text-sm">
        <p v-if="tasks.length">
          {{ t('ma.tasks') }}: <span v-for="task in tasks" :key="task.id" class="mr-2 font-mono text-xs">{{ task.id }}</span>
        </p>

        <p v-if="!fillable && outcome === null" class="text-muted">
          {{ t('ma.nothing') }}
        </p>

        <div v-if="bare.length && outcome === null" class="ds-card p-2">
          <p class="mb-1 font-medium">{{ t('ma.bare') }}</p>
          <ul class="space-y-0.5">
            <li v-for="task in bare" :key="task.id">
              <span class="font-mono text-xs">{{ task.id }}</span> {{ task.title }}
              <span class="text-xs text-muted">· {{ t('ma.bareTarget', { id: task.links.implements?.[0] ?? task.id }) }}</span>
            </li>
          </ul>
        </div>

        <div v-if="manual.length">
          <p class="mb-1 font-medium">{{ t('ma.willMark') }}</p>
          <ul class="space-y-0.5">
            <li v-for="check in manual" :key="check.id">
              <span class="font-mono text-xs">{{ check.id }}</span> {{ check.title }}
              <span v-if="kindNote(check)" class="text-xs text-muted">· {{ kindNote(check) }}</span>
              <ol v-if="stepsOf[check.id]?.length" class="ml-4 list-decimal text-xs">
                <li v-for="(step, i) in stepsOf[check.id]" :key="i">
                  {{ step.text }}<span v-if="step.expected" class="text-muted"> → {{ step.expected }}</span>
                  <UCheckbox
                    :model-value="(failedSteps[check.id] ?? []).includes(i)"
                    :label="t('ma.stepFailed')"
                    @update:model-value="(v) => (failedSteps[check.id] = v === true ? [...(failedSteps[check.id] ?? []), i] : (failedSteps[check.id] ?? []).filter((n) => n !== i))"
                  />
                </li>
              </ol>
            </li>
          </ul>
        </div>

        <div v-if="manual.length && sharedTasks.length && outcome === null" class="space-y-2 ds-card p-2">
          <div v-if="closable.length">
            <p class="mb-1 text-muted">{{ t('ma.shared') }}</p>
            <UCheckbox
              v-for="task in closable"
              :key="task.id"
              :model-value="!skipped.includes(task.id)"
              :label="t('ma.closeAlso', { id: task.id, title: task.title })"
              @update:model-value="(value) => (skipped = value === true ? skipped.filter((id) => id !== task.id) : [...skipped, task.id])"
            />
          </div>
          <div v-if="notReady.length">
            <p class="mb-1 text-warning">
              {{ t('ma.notReady') }}

            </p>
            <ul class="space-y-0.5">
              <li v-for="task in notReady" :key="task.id">
                <span class="font-mono text-xs">{{ task.id }}</span> {{ task.title }}
                <span class="text-xs text-muted">· {{ statusLabel(task.status) }}</span>
              </li>
            </ul>
          </div>
        </div>

        <template v-if="fillable && outcome === null">
          <UFormField v-if="props.roles.length" :label="t('ma.acceptedBy')" :help="t('ma.acceptedHelp')">
            <USelect v-if="!me.required"
              v-model="actor"
              class="w-full"
              :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
            /><span v-if="me.required && me.user" class="text-sm text-muted">{{ t('tw.signedIn') }}: {{ me.user.name }}</span>
          </UFormField>
          <UFormField :label="t('ma.checkedBy')" required :error="byProblem || undefined">
            <UInput v-model="by" class="w-full" :placeholder="t('ma.checkedByHint')" />
          </UFormField>
          <UFormField :label="t('ma.what')" required :error="noteProblem || undefined" :help="t('ma.whatHelp')">
            <UTextarea v-model="note" class="w-full" :rows="2" />
          </UFormField>
          <UCheckbox v-model="confirmed" :label="t('ma.confirmed')" />
        </template>

        <div v-if="outcome">
          <p class="mb-1 font-medium">{{ t('ma.result') }}</p>
          <ul class="space-y-0.5">
            <li v-for="line in outcome" :key="line.id" :class="line.ok ? '' : 'text-error'">
              <span class="font-mono text-xs">{{ line.id }}</span> — {{ line.ok ? line.text : t('ma.left', { text: line.text }) }}
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="open = false">
          {{ outcome ? t('ma.close') : t('ma.cancel') }}
        </UButton>
        <UButton v-if="outcome === null" :disabled="!canAccept" :loading="busy" @click="accept">{{ bare.length ? t('ma.acceptBare') : t('ma.accept') }}</UButton>
      </div>
    </template>
  </UModal>
</template>
