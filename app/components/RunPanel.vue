<script setup lang="ts">
import { NO_ASSIGNEE, byAssignee, factOf, kindOf, type Fact } from '~~/server/lib/verify-desk';

// Вкладка «Прогон» экрана «Сверка» (R-0062; docs/04-ui.md, «Сверка — рабочее место тестировщика»): набор проверок, сборка, итог по каждой и общий.
const route = useRoute(); const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { index, records, refresh } = useProjectIndex(projectId);

type State = 'passed' | 'failed' | 'skipped' | 'blocked';
const checks = computed(() => records.value.filter((record) => record.type === 'verification' && record.status === 'approved'));
const build = ref('');
const chosen = ref<Record<string, State>>({});
const message = ref('');
const saving = ref(false);
const items = computed(() => [
  { label: t('run.none'), value: 'none' },
  { label: t('run.passed'), value: 'passed' },
  { label: t('run.failed'), value: 'failed' },
  { label: t('run.skipped'), value: 'skipped' },
  { label: t('run.blocked'), value: 'blocked' }
]);
/** Причина блокировки обязательна: без неё прогон не записывается (R-0098). */
const reasons = ref<Record<string, string>>({});
const missingReason = computed(() => Object.entries(chosen.value).some(([id, state]) => state === 'blocked' && !reasons.value[id]?.trim()));
const who = ref('');
const { me } = useMe(() => projectId.value);
const myLogin = computed(() => me.value?.user?.login ?? '');

const ALL_KINDS = 'all';
const kind = ref(ALL_KINDS);
const kindItems = computed(() => [
  { label: t('vd.allKinds'), value: ALL_KINDS },
  ...[...new Set(checks.value.map(kindOf).filter(Boolean))].sort().map((value) => ({ label: value, value }))
]);
const visible = computed(() => byAssignee(kind.value === ALL_KINDS ? checks.value : checks.value.filter((record) => kindOf(record) === kind.value), who.value));

const picked = computed(() => Object.entries(chosen.value));
const failed = computed(() => picked.value.filter(([, state]) => state === 'failed').length);

const FACT_COLOR: Record<Fact, 'error' | 'warning' | 'neutral' | 'success'> = { failed: 'error', blocked: 'warning', awaiting: 'warning', never: 'neutral', passed: 'success' };
const factFor = (id: string, record: (typeof checks.value)[number]) => factOf(record, index.value?.verificationResults?.[id]?.state);

function choose(id: string, value: string) {
  const next = { ...chosen.value };
  if (value === 'none') delete next[id]; else next[id] = value as State;
  chosen.value = next;
}

/** Сто строк по одной не щёлкают: видимые отмечаются разом, провалы потом правятся точечно. */
function markVisiblePassed() {
  const next = { ...chosen.value };
  for (const check of visible.value) next[check.id] = 'passed';
  chosen.value = next;
}

async function submit() {
  saving.value = true;
  try {
    const response = await $fetch<{ error?: { message: string }; report?: string }>(`/api/projects/${projectId.value}/runs`, {
      method: 'POST',
      body: { build: build.value, results: chosen.value, reasons: reasons.value },
      ignoreResponseError: true
    });
    message.value = response.error ? response.error.message : t('run.saved', { report: response.report ?? '' });
    if (!response.error) { chosen.value = {}; reasons.value = {}; await refresh(); }
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <UCard>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">{{ t('run.title') }}</h2>
        <UInput v-model="build" :placeholder="t('run.build')" class="w-full sm:w-64" />
        <UButton icon="i-lucide-save" :loading="saving" :disabled="!build.trim() || picked.length === 0 || missingReason" @click="submit">{{ t('run.submit') }}</UButton>
        <p class="text-sm text-muted">{{ t('run.summary', { n: picked.length, failed }) }}</p>
      </div>
      <p v-if="message" class="mt-2 text-sm">{{ message }}</p>
    </UCard>

    <div class="flex flex-wrap items-center gap-2">
      <USelect v-model="kind" :items="kindItems" size="sm" class="w-44" :aria-label="t('vd.kind')" />
      <UButton v-if="myLogin" size="sm" :variant="who === myLogin ? 'solid' : 'soft'" color="neutral" icon="i-lucide-user" @click="who = who === myLogin ? '' : myLogin">{{ t('mb.mine') }}</UButton>
      <UButton size="sm" :variant="who === NO_ASSIGNEE ? 'solid' : 'soft'" color="neutral" icon="i-lucide-user-plus" @click="who = who === NO_ASSIGNEE ? '' : NO_ASSIGNEE">{{ t('mb.noAssignee') }}</UButton>
      <UButton size="sm" variant="soft" icon="i-lucide-check-check" :disabled="visible.length === 0" @click="markVisiblePassed">{{ t('run.markPassed') }}</UButton>
      <UButton v-if="picked.length" size="sm" variant="ghost" color="neutral" @click="chosen = {}">{{ t('run.reset') }}</UButton>
    </div>

    <p v-if="visible.length === 0" class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted">{{ t('run.empty') }}</p>
    <ul v-else class="divide-y divide-default rounded-lg border border-default">
      <li v-for="check in visible" :key="check.id" class="flex flex-wrap items-center gap-3 px-3 py-2">
        <NuxtLink :to="`/projects/${projectId}/records/${check.id}`" class="font-mono text-xs text-muted hover:underline">{{ check.id }}</NuxtLink>
        <span class="min-w-0 flex-1 text-sm">{{ check.title }}</span>
        <UBadge v-if="kindOf(check)" color="neutral" variant="outline" size="sm">{{ kindOf(check) }}</UBadge>
        <UBadge :color="FACT_COLOR[factFor(check.id, check)]" variant="subtle" size="sm">{{ t(`vd.fact.${factFor(check.id, check)}`) }}</UBadge>
        <USelect :model-value="chosen[check.id] ?? 'none'" :items="items" size="sm" class="w-40" @update:model-value="(v) => choose(check.id, String(v))" />
        <UInput v-if="chosen[check.id] === 'blocked'" v-model="reasons[check.id]" size="sm" class="w-full" :placeholder="t('run.reason')" :color="reasons[check.id]?.trim() ? undefined : 'warning'" />
      </li>
    </ul>
  </div>
</template>
