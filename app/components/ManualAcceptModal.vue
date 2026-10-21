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

const MANUAL = ['manual', 'review'];
const isManual = (record: IndexRecord) => MANUAL.includes(String(record.extra['kind'] ?? ''));
/** У автоматических видов приёмка честно помечена: прогона сборки не было (ADR-0029). */
const kindNote = (record: IndexRecord) => isManual(record) ? '' : `вид ${String(record.extra['kind'] ?? 'без вида')} — прогона сборки не было`;

const tasks = computed(() => (props.taskIds ?? []).map((id) => byId.value.get(id)).filter((r): r is IndexRecord => !!r));

/** Непройденные проверки в целевом наборе: из задач — по требованиям, из режима проверки — как есть. */
const pending = computed<IndexRecord[]>(() => {
  const results = index.value?.verificationResults ?? {};
  const ids = new Set<string>(props.verificationIds ?? []);
  const requirements = new Set(tasks.value.flatMap((task) => task.links.implements ?? []));
  for (const record of index.value?.records ?? []) {
    if (record.type !== 'verification') continue;
    if ((record.links.verifies ?? []).some((target) => requirements.has(target))) ids.add(record.id);
  }
  return [...ids]
    .map((id) => byId.value.get(id))
    .filter((r): r is IndexRecord => !!r && results[r.id]?.state !== 'passed');
});
const manual = pending;

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
  if (note.value.trim().length > 300) return 'Не длиннее 300 знаков.';
  if (note.value.trim().split('\n').length > 2) return 'Не больше двух строк.';
  return '';
});
const byProblem = computed(() => (by.value.trim().length > 80 ? 'Не длиннее 80 знаков.' : ''));
const canAccept = computed(() =>
  manual.value.length > 0 && by.value.trim() !== '' && note.value.trim() !== ''
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
    for (const check of manual.value) {
      const response = await $fetch<unknown>(`/api/projects/${props.projectId}/records/${check.id}/verified`, {
        method: 'POST',
        body: {
          verified: true, actor: actor.value, by: by.value.trim(), note: note.value.trim(),
          steps: (stepsOf.value[check.id] ?? []).map((_, i) => ((failedSteps.value[check.id] ?? []).includes(i) ? 'failed' : 'passed'))
        },
        ignoreResponseError: true
      });
      const problem = reason(response);
      lines.push({ id: check.id, ok: !problem, text: problem ?? 'отмечена вручную' });
    }
    for (const task of [...tasks.value, ...alsoClose.value]) {
      const response = await $fetch<unknown>(`/api/projects/${props.projectId}/records/${task.id}/status`, {
        method: 'POST',
        body: { status: 'done', actor: actor.value, version: task.version },
        ignoreResponseError: true
      });
      const problem = reason(response);
      lines.push({ id: task.id, ok: !problem, text: problem ?? 'переведена в «Готово»' });
    }
    outcome.value = lines;
    await refresh();
    emit('changed');
  } finally {
    busy.value = false;
  }
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
    title="Принять вручную"
    description="Отметка «Проверено» на ручных проверках и повторный перевод задач."
  >
    <template #body>
      <div class="space-y-4 text-sm">
        <p v-if="tasks.length">
          Задачи: <span v-for="task in tasks" :key="task.id" class="mr-2 font-mono text-xs">{{ task.id }}</span>
        </p>

        <p v-if="manual.length === 0" class="text-muted">
          Принимать вручную нечего: непройденных проверок у этих записей нет.
        </p>

        <div v-if="manual.length">
          <p class="mb-1 font-medium">Будут отмечены «Проверено»</p>
          <ul class="space-y-0.5">
            <li v-for="check in manual" :key="check.id">
              <span class="font-mono text-xs">{{ check.id }}</span> {{ check.title }}
              <span v-if="kindNote(check)" class="text-xs text-muted">· {{ kindNote(check) }}</span>
              <ol v-if="stepsOf[check.id]?.length" class="ml-4 list-decimal text-xs">
                <li v-for="(step, i) in stepsOf[check.id]" :key="i">
                  {{ step.text }}<span v-if="step.expected" class="text-muted"> → {{ step.expected }}</span>
                  <UCheckbox
                    :model-value="(failedSteps[check.id] ?? []).includes(i)"
                    label="шаг не прошёл"
                    @update:model-value="(v) => (failedSteps[check.id] = v === true ? [...(failedSteps[check.id] ?? []), i] : (failedSteps[check.id] ?? []).filter((n) => n !== i))"
                  />
                </li>
              </ol>
            </li>
          </ul>
        </div>

        <div v-if="manual.length && sharedTasks.length && outcome === null" class="space-y-2 ds-card p-2">
          <div v-if="closable.length">
            <p class="mb-1 text-muted">Проверка общая: эти задачи тоже на проверке — закроются тем же приёмом.</p>
            <UCheckbox
              v-for="task in closable"
              :key="task.id"
              :model-value="!skipped.includes(task.id)"
              :label="`Закрыть и ${task.id} — ${task.title}`"
              @update:model-value="(value) => (skipped = value === true ? skipped.filter((id) => id !== task.id) : [...skipped, task.id])"
            />
          </div>
          <div v-if="notReady.length">
            <p class="mb-1 text-warning">
              Требование реализовано не полностью: эти задачи не переводятся, а когда дойдут до «на проверке»,
              пройденная проверка их уже не задержит.
            </p>
            <ul class="space-y-0.5">
              <li v-for="task in notReady" :key="task.id">
                <span class="font-mono text-xs">{{ task.id }}</span> {{ task.title }}
                <span class="text-xs text-muted">· {{ statusLabel(task.status) }}</span>
              </li>
            </ul>
          </div>
        </div>

        <template v-if="manual.length && outcome === null">
          <UFormField v-if="props.roles.length" label="Кто принял" help="Роль из манифеста; по умолчанию — ревьюер задачи.">
            <USelect v-if="!me.required"
              v-model="actor"
              class="w-full"
              :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
            /><span v-if="me.required && me.user" class="text-sm text-muted">Вошли: {{ me.user.name }}</span>
          </UFormField>
          <UFormField label="Кто проверил" required :error="byProblem || undefined">
            <UInput v-model="by" class="w-full" placeholder="Имя того, кто проверил" />
          </UFormField>
          <UFormField label="Что проверено" required :error="noteProblem || undefined" help="Одна-две строки, до 300 знаков.">
            <UTextarea v-model="note" class="w-full" :rows="2" />
          </UFormField>
          <UCheckbox v-model="confirmed" label="Проверил вручную" />
        </template>

        <div v-if="outcome">
          <p class="mb-1 font-medium">Итог</p>
          <ul class="space-y-0.5">
            <li v-for="line in outcome" :key="line.id" :class="line.ok ? '' : 'text-error'">
              <span class="font-mono text-xs">{{ line.id }}</span> — {{ line.ok ? line.text : `осталась: ${line.text}` }}
            </li>
          </ul>
        </div>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton variant="ghost" color="neutral" @click="open = false">
          {{ outcome ? 'Закрыть' : 'Отмена' }}
        </UButton>
        <UButton v-if="outcome === null" :disabled="!canAccept" :loading="busy" @click="accept">Принять</UButton>
      </div>
    </template>
  </UModal>
</template>
