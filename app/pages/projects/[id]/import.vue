<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { SurveyRow } from '~~/server/lib/import';

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
  { label: 'Требование', value: 'requirement' },
  { label: 'Документ', value: 'design' },
  { label: 'Решение', value: 'decision' },
  { label: 'Контракт', value: 'contract' },
  { label: 'Задача', value: 'task' },
  { label: 'Фаза', value: 'phase' },
  { label: 'Проверка', value: 'verification' }
];

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
        <h1 class="text-xl font-semibold">Импорт документации</h1>
        <p v-if="survey" class="text-sm text-muted">
          {{ plan.length }} файлов в {{ survey.folders.join(', ') || 'каталогах из sources.docs' }}
        </p>
      </div>

      <p class="text-sm text-muted">
        Тип — <strong>предположение по пути</strong>, а не решение: правьте его в
        каждой строке. Приложение не обращается к языковым моделям, его дело —
        показать найденное и аккуратно применить то, что вы утвердите.
      </p>

      <div
        v-if="survey && survey.folders.length === 0"
        class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        В манифесте не объявлено <code>sources.docs</code> — приложению негде искать
        старую документацию. Добавьте в <code>docs/development/project.yaml</code> список папок.
      </div>

      <div
        v-else-if="plan.length === 0 && status !== 'pending'"
        class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        Ни одного файла <code>.md</code> не нашлось. Либо всё уже перенесено, либо
        документация лежит в другой папке.
      </div>

      <div v-else class="overflow-x-auto rounded-lg border border-default">
        <table class="w-full text-sm">
          <thead class="border-b border-default text-left text-muted">
            <tr>
              <th class="p-3 font-medium">Брать</th>
              <th class="p-3 font-medium">Файл</th>
              <th class="p-3 font-medium">Заголовок</th>
              <th class="p-3 font-medium">Тип</th>
              <th class="p-3 font-medium">Почему</th>
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
                  placeholder="выберите тип"
                  :items="TYPES"
                  :disabled="entry.hasFrontMatter"
                />
              </td>
              <td class="p-3 text-xs text-muted">
                <UBadge v-if="entry.hasFrontMatter" color="neutral" variant="subtle" size="sm">
                  уже запись
                </UBadge>
                <span v-else>{{ entry.reason }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="plan.length" class="flex flex-wrap items-center gap-3">
        <UButton :disabled="chosen.length === 0" :loading="applying" @click="apply">
          Перенести {{ chosen.length }} из {{ plan.length }}
        </UButton>
        <p class="text-sm text-muted">
          Файлы переедут в папки своих разделов и получат front matter.
          <strong>Текст документов не изменится</strong> — ни строки, ни перевода строки.
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
            <h2 class="font-medium">Перенесено: {{ result.moved.length }}</h2>
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
            <h2 class="font-medium">Пропущено: {{ result.skipped.length }}</h2>
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
