<script setup lang="ts">
import type { MapDiff as MapDiffValue } from '~~/server/lib/map-diff';
import type { IndexRecord } from '~~/server/lib/types';

/**
 * Записи карт (R-0146, A-0010 п. 10): наверху — только ждущие подтверждения, у каждой «Подтвердить»
 * с разницей сбоку. Подтверждённые, вне суммы и смены курса — один свёрнутый «Архив карт»; раскрыт ли
 * он, помнит браузер. Новую карту подтверждают отсюда, не ища её по номеру.
 */
const props = defineProps<{
  projectId: string;
  pending: IndexRecord[];
  archive: { label: string; records: IndexRecord[] }[];
  course?: number;
  roles: { id: string; name: string }[];
}>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

const STORAGE_KEY = 'docdd:map-archive-open';
const archiveOpen = ref(false);
onMounted(() => {
  try {
    archiveOpen.value = localStorage.getItem(STORAGE_KEY) === '1';
  } catch { /* хранилище закрыто — архив свёрнут */ }
});
function toggleArchive() {
  archiveOpen.value = !archiveOpen.value;
  try {
    localStorage.setItem(STORAGE_KEY, archiveOpen.value ? '1' : '0');
  } catch { /* не запомнится — не страшно */ }
}
const archived = computed(() => props.archive.reduce((sum, group) => sum + group.records.length, 0) + (props.course ?? 0));

// Подтверждение сбоку: разница на схеме, отметка просмотра — от неё зависит строка журнала (R-0068).
const { me, allowed } = useMe(() => props.projectId);
const denied = computed(() => allowed('approve'));
const actor = ref(props.roles[0]?.id ?? '');
// Роли приходят с индексом позже карточки: без этого подпись в журнале вышла бы пустой.
watch(() => props.roles, (roles) => { if (!actor.value) actor.value = roles[0]?.id ?? ''; });
const current = ref<IndexRecord | null>(null);
const panelOpen = computed({ get: () => current.value !== null, set: (value) => { if (!value) current.value = null; } });
const diff = ref<MapDiffValue | null>(null);
const loading = ref(false);
const busy = ref(false);
const problem = ref('');

async function openDiff(record: IndexRecord) {
  current.value = record;
  diff.value = null;
  problem.value = '';
  loading.value = true;
  try {
    const answer = await $fetch<MapDiffValue | { error: { message: string } }>(
      `/api/projects/${props.projectId}/records/${record.id}/map-diff`, { ignoreResponseError: true }
    );
    if ('error' in answer) problem.value = answer.error.message;
    else diff.value = answer;
    await $fetch(`/api/projects/${props.projectId}/records/${record.id}/diff/viewed`, { method: 'POST', ignoreResponseError: true });
  } finally {
    loading.value = false;
  }
}

/** Черновик идёт через «на подтверждении»: прямого draft → approved у карты может не быть. */
async function approve() {
  const record = current.value;
  if (!record) return;
  busy.value = true;
  problem.value = '';
  try {
    for (const status of record.status === 'draft' ? ['review', 'approved'] : ['approved']) {
      const answer = await $fetch<{ error?: { message: string; blockers?: { message: string }[] } }>(
        `/api/projects/${props.projectId}/records/${record.id}/status`,
        { method: 'POST', body: { status, actor: actor.value }, ignoreResponseError: true }
      );
      if (answer?.error) {
        problem.value = [answer.error.message, ...(answer.error.blockers ?? []).map((item) => item.message)].join(' ');
        return;
      }
    }
    current.value = null;
    emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <span class="block font-medium">{{ t('maps.records.title') }}</span>
      <span class="block text-sm text-muted">{{ pending.length ? t('maps.records.pending', { n: pending.length }) : t('maps.records.nonePending') }}</span>
    </template>

    <ul v-if="pending.length" class="mb-3 space-y-2 text-sm">
      <li v-for="record in pending" :key="record.id" class="flex flex-wrap items-center gap-3">
        <RecordLink :project-id="projectId" :record-id="record.id" :record="record" />
        <UButton size="xs" icon="i-lucide-git-compare" :disabled="!denied.allowed" @click="openDiff(record)">
          {{ t('maps.records.approve') }}
        </UButton>
      </li>
    </ul>

    <div v-if="archived > 0">
      <button type="button" class="flex items-center gap-2 text-left text-sm" :aria-expanded="archiveOpen" @click="toggleArchive">
        <UIcon :name="archiveOpen ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4 shrink-0" />
        <span class="font-medium">{{ t('maps.records.archive', { n: archived }) }}</span>
      </button>
      <div v-if="archiveOpen" class="mt-2 space-y-1 pl-6 text-sm">
        <p v-for="group in archive" :key="group.label" class="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span class="text-muted">{{ group.label }}:</span>
          <RecordLink v-for="record in group.records" :key="record.id" :project-id="projectId" :record-id="record.id" :record="record" />
        </p>
        <p v-if="course" class="text-xs text-muted">{{ t('maps.records.course', { n: course }) }}</p>
      </div>
    </div>

    <USlideover v-model:open="panelOpen" :title="current ? `${current.id} · ${current.title}` : ''" :description="t('maps.records.diffHint')">
      <template #body>
        <p v-if="loading" class="text-sm text-muted">{{ t('maps.records.loading') }}</p>
        <MapDiff v-else-if="diff" :diff="diff" />
        <UAlert v-if="problem" class="mt-3" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="problem" />
      </template>
      <template #footer>
        <div class="flex w-full flex-wrap items-center justify-end gap-2">
          <USelect
            v-if="roles.length && !me.required"
            v-model="actor"
            size="sm"
            class="w-44"
            :items="roles.map((role) => ({ label: role.name, value: role.id }))"
          />
          <UButton variant="ghost" color="neutral" @click="current = null">{{ t('ma.cancel') }}</UButton>
          <UButton :loading="busy" :disabled="loading || !denied.allowed" icon="i-lucide-check" @click="approve">{{ t('maps.records.approve') }}</UButton>
        </div>
      </template>
    </USlideover>
  </UCard>
</template>
