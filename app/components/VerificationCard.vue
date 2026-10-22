<script setup lang="ts">
import type { IndexRecord, ProjectIndex } from '~~/server/lib/types';
import { attachmentKind } from '~~/server/lib/attachments';
import { assigneeOf, kindOf, runHistory } from '~~/server/lib/verify-desk';

/**
 * «Как проверить» на странице проверки (docs/04-ui.md, «Карточка проверки — для
 * тестировщика»): каким способом, что проверяет и кто это строит, когда её гоняли.
 */
const props = defineProps<{ projectId: string; record: IndexRecord; index: ProjectIndex | null }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

const kind = computed(() => kindOf(props.record));
const MANUAL = new Set(['manual', 'review']);
const manual = computed(() => MANUAL.has(kind.value));
const runner = computed(() => String(props.record.extra['runner'] ?? ''));
const command = computed(() => String(props.record.extra['command'] ?? ''));
const result = computed(() => props.index?.verificationResults[props.record.id]);

const byId = computed(() => new Map((props.index?.records ?? []).map((record) => [record.id, record])));
/** Что проверяет — связь ставят с любой стороны, как в списке проверок. */
const targets = computed(() => {
  const ids = new Set([...(props.record.links.verifies ?? []), ...(props.record.backlinks?.verified_by ?? [])]);
  return [...ids].map((id) => ({
    id,
    record: byId.value.get(id) ?? null,
    tasks: (props.index?.records ?? []).filter((task) => task.type === 'task' && (task.links.implements ?? []).includes(id))
  }));
});

const history = computed(() => runHistory(props.index?.reports ?? [], props.record.id));

/** Исполнитель проверки (R-0097): «Взять на себя» — вошедший; без входа — по логину из поля. */
const { me } = useMe(() => props.projectId);
const myLogin = computed(() => me.value?.user?.login ?? '');
const assignee = computed(() => assigneeOf(props.record));
const typed = ref('');
const busy = ref(false);
const failure = ref('');
async function assign(login: string | null) {
  busy.value = true;
  failure.value = '';
  try {
    const response = await $fetch<{ error?: { message: string } }>(`/api/projects/${props.projectId}/records/${props.record.id}`, { method: 'PATCH', body: { assignee: login, version: props.record.version }, ignoreResponseError: true });
    if (response?.error) failure.value = response.error.message;
    else { typed.value = ''; emit('changed'); }
  } finally {
    busy.value = false;
  }
}

const copied = ref(false);
async function copy() {
  try {
    await navigator.clipboard.writeText(command.value);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  } catch { /* буфер недоступен — команду видно и так */ }
}
const assigneeOf = (task: IndexRecord) => (typeof task.extra['assignee'] === 'string' ? task.extra['assignee'] : '');
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-2">
        <h2 class="font-medium">{{ t('vc.title') }}</h2>
        <UBadge v-if="kind" color="neutral" variant="outline">{{ t(`vc.kind.${kind}`) }}</UBadge>
        <UBadge v-if="result" :color="statusColor(result.state)" variant="subtle">{{ resultLabel(result.state) }} · {{ result.at.slice(0, 10) }}</UBadge>
        <UBadge v-else color="neutral" variant="subtle">{{ t('tp.neverRan') }}</UBadge>
      </div>
    </template>

    <div class="space-y-5">
      <!-- Кто прогоняет. -->
      <section class="flex flex-wrap items-center gap-2 text-sm">
        <UIcon name="i-lucide-user" class="size-4 text-muted" />
        <span class="font-medium">{{ t('vc.assignee') }}:</span>
        <span v-if="assignee">{{ assignee }}</span>
        <span v-else class="text-warning">{{ t('mb.unassigned') }}</span>
        <UButton v-if="myLogin && assignee !== myLogin" size="xs" variant="soft" :loading="busy" @click="assign(myLogin)">{{ t('vc.takeOn') }}</UButton>
        <form class="flex items-center gap-1" @submit.prevent="typed.trim() && assign(typed.trim())">
          <UInput v-model="typed" size="xs" :placeholder="t('mb.login')" class="w-36" />
          <UButton type="submit" size="xs" variant="ghost" color="neutral" icon="i-lucide-check" :disabled="!typed.trim()" :aria-label="t('mb.assignShort')" />
        </form>
        <UButton v-if="assignee" size="xs" variant="ghost" color="neutral" :loading="busy" @click="assign(null)">{{ t('mb.unassign') }}</UButton>
        <span v-if="failure" class="w-full text-error">{{ failure }}</span>
      </section>

      <!-- Способ: автоматическую гоняет сборка, ручную — человек. -->
      <section v-if="!manual" class="space-y-2">
        <p class="text-sm font-medium">{{ t('vc.how') }}</p>
        <div v-if="command" class="flex items-center gap-2 rounded-md bg-elevated px-3 py-2">
          <code class="min-w-0 flex-1 overflow-x-auto whitespace-nowrap text-sm">{{ command }}</code>
          <UButton size="xs" variant="ghost" color="neutral" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" :aria-label="t('ms.copy')" @click="copy" />
        </div>
        <p v-else class="text-sm text-warning">{{ t('vc.noCommand') }}</p>
        <p class="text-xs text-muted">{{ runner ? t('vc.runner', { runner }) : '' }} {{ t('vc.autoHint') }}</p>
      </section>
      <section class="space-y-2">
        <p v-if="manual" class="text-sm font-medium">{{ t('vc.manual') }}</p>
        <VerifiedCheck :project-id="projectId" :record="record" :result="result" :roles="index?.project.roles ?? []" @changed="emit('changed')" />
        <DefectFromCheck :project-id="projectId" :record="record" :result="result" :attachments="history[0]?.attachments ?? []" />
      </section>

      <!-- Что проверяет и кто это строит: задача на приёмке — есть что тестировать. -->
      <section v-if="targets.length" class="space-y-2">
        <p class="text-sm font-medium">{{ t('vc.verifies') }}</p>
        <div v-for="target in targets" :key="target.id" class="rounded-md border border-default p-3">
          <div class="flex flex-wrap items-center gap-2">
            <RecordLink :project-id="projectId" :record-id="target.id" :record="index ? target.record : undefined" />
            <StatusBadge v-if="target.record" :status="target.record.status" />
          </div>
          <ul v-if="target.tasks.length" class="mt-2 space-y-1 text-sm">
            <li v-for="task in target.tasks" :key="task.id" class="flex flex-wrap items-center gap-2">
              <RecordLink :project-id="projectId" :record-id="task.id" :record="task" />
              <StatusBadge :status="task.status" />
              <span class="text-xs text-muted">{{ assigneeOf(task) || t('mb.unassigned') }}</span>
            </li>
          </ul>
          <p v-else class="mt-1 text-xs text-muted">{{ t('vc.noTasks') }}</p>
        </div>
      </section>

      <!-- Когда гоняли и что вышло. -->
      <section class="space-y-2">
        <p class="text-sm font-medium">{{ t('vc.history') }}</p>
        <p v-if="history.length === 0" class="text-sm text-muted">{{ t('vc.noHistory') }}</p>
        <ul v-else class="divide-y divide-default rounded-md border border-default text-sm">
          <li v-for="(run, at) in history" :key="at" class="flex flex-wrap items-center gap-2 px-3 py-2">
            <span class="font-mono text-xs">{{ run.at.replace('T', ' ').slice(0, 16) }}</span>
            <UBadge :color="statusColor(run.state)" variant="subtle" size="sm">{{ resultLabel(run.state) }}</UBadge>
            <span class="text-xs text-muted">{{ run.checkedBy ? `${run.runner} · ${run.checkedBy}` : run.runner }}</span>
            <span v-if="run.attachments?.length" class="flex w-full flex-wrap items-center gap-2">
              <a v-for="path in run.attachments" :key="path" :href="`/api/projects/${projectId}/attachment?path=${encodeURIComponent(path)}`" target="_blank" rel="noopener" class="text-xs">
                <img v-if="attachmentKind(path) === 'image'" :src="`/api/projects/${projectId}/attachment?path=${encodeURIComponent(path)}`" :alt="path" class="h-16 rounded border border-default">
                <span v-else class="inline-flex items-center gap-1 underline"><UIcon name="i-lucide-file-text" class="size-3.5" />{{ path.split('/').pop() }}</span>
              </a>
            </span>
            <span v-if="run.reason" class="w-full text-xs text-warning">{{ t('vc.blockedBy', { reason: run.reason }) }}</span>
            <span v-if="run.note" class="w-full text-xs text-muted">{{ run.note }}</span>
          </li>
        </ul>
      </section>
    </div>
  </UCard>
</template>
