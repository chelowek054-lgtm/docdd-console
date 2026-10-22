<script setup lang="ts">
// Вкладка «Импорт» экрана «Наполнение»: входящее и импорт на одном экране (docs/04-ui.md, «Навигация»).
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { SurveyRow } from '~~/server/lib/import'; const { t } = useT();

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { data, refresh: refreshSurvey, status } = useFetch<
  { folders: string[]; rows: SurveyRow[] } | { error: ApiFailure }
>(() => `/api/projects/${projectId.value}/import`, { key: () => `import:${projectId.value}` });

const failure = computed(() => failureOf(data.value));
const survey = computed(() => (failure.value ? null : (data.value as { folders: string[]; rows: SurveyRow[] } | null)));

interface PlanEntry {
  path: string;
  title: string;
  type: string;
  include: boolean;
  hasFrontMatter: boolean;
  reason: string;
  bytes: number;
}

const plan = ref<PlanEntry[]>([]);

watch(survey, (value) => {
  plan.value = (value?.rows ?? []).map((row) => ({
    path: row.path,
    title: row.title,
    type: row.suggestedType ?? '',
    // Файл, у которого front matter уже есть, — запись, а не импорт.
    include: !row.hasFrontMatter && row.suggestedType !== null,
    hasFrontMatter: row.hasFrontMatter,
    reason: row.reason,
    bytes: row.bytes
  }));
}, { immediate: true });

// Пустого значения в списке быть не может: «тип не выбран» показывается
// подсказкой, и такая строка в перенос не попадает.
const TYPES = [
  { get label() { return t('t83.m3.type.requirement'); }, value: 'requirement' },
  { get label() { return t('t83.m3.type.design'); }, value: 'design' },
  { get label() { return t('t83.m3.type.decision'); }, value: 'decision' },
  { get label() { return t('t83.m3.type.contract'); }, value: 'contract' },
  { get label() { return t('t83.m3.type.task'); }, value: 'task' },
  { get label() { return t('t83.m3.type.phase'); }, value: 'phase' },
  { get label() { return t('t83.m3.type.verification'); }, value: 'verification' }
];

/** «Выбрать всё» трогает только то, что можно перенести: файл с front matter — запись, а не импорт. */
const tickable = computed(() => plan.value.filter((entry) => !entry.hasFrontMatter));
const allState = computed<boolean | 'indeterminate'>(() => {
  const on = tickable.value.filter((entry) => entry.include).length;
  if (on === 0) return false;
  return on === tickable.value.length ? true : 'indeterminate';
});

function toggleAll() {
  const next = allState.value !== true;
  for (const entry of tickable.value) entry.include = next;
}

const chosen = computed(() => plan.value.filter((entry) => entry.include && entry.type !== ''));

const applying = ref(false);
const result = ref<{ moved: { from: string; to: string; id: string }[]; skipped: { path: string; reason: string }[] } | null>(null);
const applyFailure = ref<ApiFailure | null>(null);

async function apply() {
  applying.value = true;
  applyFailure.value = null;
  result.value = null;
  try {
    const response = await $fetch(`/api/projects/${projectId.value}/import`, {
      method: 'POST',
      body: { rows: chosen.value.map(({ path, type, title }) => ({ path, type, title })) },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      applyFailure.value = problem;
      return;
    }
    result.value = response as typeof result.value;
    await refreshSurvey();
  } finally {
    applying.value = false;
  }
}

function size(bytes: number): string {
  return bytes < 1024 ? `${bytes} Б` : `${Math.round(bytes / 1024)} КБ`;
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">{{ t('t83.import-panel.1') }}</h2>
        <p v-if="survey" class="text-sm text-muted">
          {{ t('t83.m3.imp.dirs', { n: plan.length, dirs: survey.folders.join(', ') || t('t83.m3.imp.fallback') }) }}
        </p>
      </div>

      <p class="text-sm text-muted">
        {{ t('t83.import-panel.2') }} <strong>{{ t('t83.import-panel.3') }}</strong>{{ t('t83.import-panel.4') }}


      </p>

      <div
        v-if="survey && survey.folders.length === 0"
        class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        {{ t('t83.import-panel.5') }} <code>sources.docs</code> {{ t('t83.import-panel.6') }}
 <code>docs/development/project.yaml</code>.
      </div>
      <SourcesFinder v-if="survey && survey.folders.length === 0" :project-id="projectId" only="docs" @applied="refreshSurvey()" />

      <div
        v-else-if="plan.length === 0 && status !== 'pending'"
        class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        {{ t('t83.import-panel.7') }} <code>.md</code> {{ t('t83.import-panel.8') }}

      </div>

      <div v-else class="ds-card overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="p-3 font-medium">
                <UCheckbox
                  :model-value="allState"
                  :disabled="tickable.length === 0"
                  :aria-label="t('t83.inbox-panel.15')"
                  @update:model-value="toggleAll"
                />
                <span class="sr-only">{{ t('t83.import-panel.9') }}</span>
              </th>
              <th class="p-3 font-medium">{{ t('t83.import-panel.10') }}</th>
              <th class="p-3 font-medium">{{ t('t83.inbox-panel.10') }}</th>
              <th class="p-3 font-medium">{{ t('t83.import-panel.11') }}</th>
              <th class="p-3 font-medium">{{ t('t83.import-panel.12') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="entry in plan" :key="entry.path" :class="entry.hasFrontMatter ? 'opacity-60' : ''">
              <td class="p-3">
                <UCheckbox v-model="entry.include" :disabled="entry.hasFrontMatter" />
              </td>
              <td class="p-3">
                <span class="font-mono text-xs">{{ entry.path }}</span>
                <span class="ml-2 text-xs text-muted">{{ size(entry.bytes) }}</span>
              </td>
              <td class="p-3">
                <UInput v-model="entry.title" size="sm" :disabled="entry.hasFrontMatter" />
              </td>
              <td class="p-3">
                <USelect
                  v-model="entry.type"
                  size="sm"
                  class="w-40"
                  :placeholder="t('t83.import-panel.13')"
                  :items="TYPES"
                  :disabled="entry.hasFrontMatter"
                />
              </td>
              <td class="p-3 text-xs text-muted">
                <UBadge v-if="entry.hasFrontMatter" color="neutral" variant="subtle" size="sm">
                  {{ t('t83.import-panel.14') }}
                </UBadge>
                <span v-else>{{ entry.reason }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="plan.length" class="flex flex-wrap items-center gap-3">
        <UButton :disabled="chosen.length === 0" :loading="applying" @click="apply">
          {{ t('t83.import-panel.15', { length: chosen.length, length2: plan.length }) }}
        </UButton>
        <p class="text-sm text-muted">
          {{ t('t83.import-panel.16') }}
          <strong>{{ t('t83.import-panel.17') }}</strong> {{ t('t83.import-panel.18') }}
        </p>
      </div>

      <UAlert
        v-if="applyFailure"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="applyFailure.message"
        :description="applyFailure.detail"
      />

      <div v-if="result" class="space-y-3">
        <UCard v-if="result.moved.length">
          <template #header>
            <h2 class="font-medium">{{ t('t83.import-panel.19', { length: result.moved.length }) }}</h2>
          </template>
          <ul class="space-y-1 text-sm">
            <li v-for="item in result.moved" :key="item.from" class="flex flex-wrap gap-2">
              <NuxtLink
                :to="`/projects/${projectId}/records/${item.id}`"
                class="font-mono text-xs hover:underline"
              >{{ item.id }}</NuxtLink>
              <span class="font-mono text-xs text-muted">{{ item.from }} → {{ item.to }}</span>
            </li>
          </ul>
        </UCard>

        <UCard v-if="result.skipped.length">
          <template #header>
            <h2 class="font-medium">{{ t('t83.import-panel.20', { length: result.skipped.length }) }}</h2>
          </template>
          <ul class="space-y-1 text-sm">
            <li v-for="item in result.skipped" :key="item.path">
              <span class="font-mono text-xs">{{ item.path }}</span>
              <span class="text-muted"> — {{ item.reason }}</span>
            </li>
          </ul>
        </UCard>
      </div>
    </template>
  </div>
</template>
