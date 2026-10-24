<script setup lang="ts">
import type { Coverage, TestMatch } from '~~/server/lib/test-checks';
import type { FileFinding } from '~~/server/lib/source-detect';

/**
 * Проверки из существующих тестов (R-0079, docs/04-ui.md, «Подключение»): какие
 * тестовые файлы нашлись, каким требованиям они подходят (с причиной) и какие
 * требования уже покрыты. «Завести проверки» создаёт черновики; отчёт сборки
 * раннера подключается путём к файлу (JSON vitest/jest или JUnit-XML).
 */
const props = defineProps<{ projectId: string }>();
const emit = defineEmits<{ changed: [] }>();
const { t } = useT();

interface Report { matches: TestMatch[]; coverage: Coverage; found: number; already: number }
const { data, refresh, pending } = useFetch<Report>(() => `/api/projects/${props.projectId}/onboarding/tests`, { key: () => `tests-scan:${props.projectId}`, server: false, lazy: true });
const { data: sources } = useFetch<{ files: FileFinding[] }>(() => `/api/projects/${props.projectId}/sources/detect`, { key: () => `sources:${props.projectId}:`, server: false, lazy: true });
const reportsFound = computed(() => (sources.value?.files ?? []).filter((file) => file.kind === 'ci_report'));

const matched = computed(() => (data.value?.matches ?? []).filter((item) => item.requirement));
const unmatched = computed(() => (data.value?.matches ?? []).filter((item) => !item.requirement));
const shown = ref(10);

const busy = ref(false);
const message = ref('');
const reportPath = ref('');

async function call(body: unknown): Promise<{ created?: number; matched?: number; unmatched?: string[]; error?: { message: string } }> {
  return await $fetch(`/api/projects/${props.projectId}/onboarding/tests`, { method: 'POST', body, ignoreResponseError: true });
}

async function create() {
  busy.value = true;
  message.value = '';
  try {
    const response = await call({});
    message.value = response.error ? response.error.message : t('tc.created', { n: response.created ?? 0 });
    await refresh();
    emit('changed');
  } finally {
    busy.value = false;
  }
}

async function connect() {
  busy.value = true;
  message.value = '';
  try {
    const response = await call({ report: reportPath.value });
    message.value = response.error ? response.error.message : t('tc.connected', { n: response.matched ?? 0, rest: response.unmatched?.length ?? 0 });
    await refresh();
    emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">{{ t('tc.title') }}</h2>
        <UBadge v-if="data" color="neutral" variant="soft">{{ t('tc.coverage', { percent: data.coverage.percent, done: data.coverage.covered.length, total: data.coverage.covered.length + data.coverage.uncovered.length }) }}</UBadge>
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-refresh-cw" :loading="pending" :aria-label="t('src.rescan')" @click="refresh()" />
      </div>
    </template>

    <p v-if="pending && !data" class="text-sm text-muted">{{ t('src.scanning') }}</p>
    <div v-else-if="data" class="space-y-4 text-sm">
      <p class="text-muted">{{ t('tc.summary', { found: data.found, already: data.already, matched: matched.length, rest: unmatched.length }) }}</p>

      <div v-if="matched.length" class="space-y-1">
        <p class="text-xs font-medium">{{ t('tc.proposed') }}</p>
        <p v-for="item in matched.slice(0, shown)" :key="item.test.path" class="flex flex-wrap items-center gap-2 text-xs">
          <span class="font-mono">{{ item.test.path }}</span>
          <UBadge size="sm" variant="outline" color="neutral">{{ item.test.kind }}</UBadge>
          <NuxtLink :to="`/projects/${projectId}/records/${item.requirement!.id}`" class="font-mono text-primary hover:underline">{{ item.requirement!.id }}</NuxtLink>
          <span class="text-muted">{{ item.why }}</span>
        </p>
        <UButton v-if="matched.length > shown" size="xs" variant="ghost" color="neutral" @click="shown += 20">{{ t('src.more', { n: matched.length - shown }) }}</UButton>
        <div class="flex items-center gap-3 pt-2">
          <UButton size="sm" :loading="busy" @click="create">{{ t('tc.create') }}</UButton>
          <span class="text-xs text-muted">{{ t('tc.draftNote') }}</span>
        </div>
      </div>

      <div v-if="data.coverage.uncovered.length" class="space-y-0.5">
        <p class="text-xs font-medium text-warning">{{ t('tc.uncovered', { n: data.coverage.uncovered.length }) }}</p>
        <p v-for="item in data.coverage.uncovered.slice(0, 6)" :key="item.id" class="text-xs"><NuxtLink :to="`/projects/${projectId}/records/${item.id}`" class="font-mono text-primary hover:underline">{{ item.id }}</NuxtLink> <span class="text-muted">{{ item.title }}</span></p>
      </div>

      <div class="space-y-2 border-t border-default pt-3">
        <p class="text-xs font-medium">{{ t('tc.reportHead') }}</p>
        <div class="flex flex-wrap items-center gap-2">
          <UInput v-model="reportPath" size="sm" class="w-full sm:w-96" :placeholder="reportsFound[0]?.path ?? 'reports/junit.xml'" />
          <UButton size="sm" variant="soft" :loading="busy" :disabled="!reportPath.trim()" @click="connect">{{ t('tc.connect') }}</UButton>
        </div>
        <p v-if="reportsFound.length" class="flex flex-wrap gap-2 text-xs text-muted">
          {{ t('tc.found') }}
          <button v-for="file in reportsFound.slice(0, 4)" :key="file.path" type="button" class="font-mono text-primary hover:underline" @click="reportPath = file.path">{{ file.path }}</button>
        </p>
      </div>
      <p v-if="message" class="text-xs text-muted">{{ message }}</p>
    </div>
  </UCard>
</template>
