<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ReferenceReport } from '~~/server/utils/reference-service';

/**
 * Справочник (docs/04-ui.md, «Справочник»; docs/13-reference.md): справки и индекс,
 * который уходит в запросы модели. Индекс ведёт приложение — здесь его состояние и
 * кнопка пересборки; руками он не правится.
 */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { data, refresh } = useFetch<ReferenceReport | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/reference`,
  { key: () => `reference:${projectId.value}` }
);
const failure = computed(() => failureOf(data.value));
const report = computed(() => (failure.value ? null : (data.value as ReferenceReport | null)));
const { records, refresh: refreshIndex } = useProjectIndex(projectId);

const busy = ref(false);
const trouble = ref<ApiFailure | null>(null);
async function rebuild() {
  busy.value = true;
  trouble.value = null;
  try {
    const response = await $fetch(`/api/projects/${projectId.value}/reference/rebuild`, { method: 'POST', ignoreResponseError: true });
    const problem = failureOf(response);
    if (problem) trouble.value = problem;
    await refresh();
  } finally {
    busy.value = false;
  }
}

async function created() {
  await Promise.all([refresh(), refreshIndex()]);
}

const KIND_LABEL: Record<string, string> = { component: 'компонент', api: 'сервис, API', technique: 'приём', data: 'данные' };
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else-if="report">
      <h1 class="text-xl font-semibold">Справочник</h1>

      <UAlert
        v-if="!report.enabled"
        color="neutral"
        variant="subtle"
        icon="i-lucide-library"
        title="Справочник не включён"
        description="Впишите в манифест paths.reference (например, reference): там будут лежать справки о модулях, готовых решениях и приёмах, а индекс по ним уйдёт в запросы модели."
      />

      <template v-else>
        <div v-if="report.index" class="space-y-2 rounded border border-default p-4">
          <div class="flex flex-wrap items-center gap-3">
            <p class="text-sm">
              <span :class="report.index.fresh ? 'text-success' : 'font-semibold text-warning'">
                {{ report.index.fresh ? 'Индекс свежий' : report.index.exists ? 'Индекс устарел' : 'Индекса ещё нет' }}
              </span>
              · {{ report.index.lines }} строк · <span class="font-mono text-xs">{{ report.index.path }}</span>
            </p>
            <UButton size="sm" variant="soft" icon="i-lucide-refresh-cw" :loading="busy" @click="rebuild">Обновить индекс</UButton>
          </div>
          <p v-if="report.index.undescribedModules" class="text-sm text-muted">
            Модулей без описания: {{ report.index.undescribedModules }} — по ним индекс не защищает от дублей. Описание берётся из карты кода (поле summary), его подтверждают на экране «Карты».
          </p>
          <UAlert v-if="trouble" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="trouble.message" :description="trouble.detail" />
          <details>
            <summary class="cursor-pointer text-sm">Что уйдёт в запрос модели</summary>
            <pre class="mt-2 max-h-96 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre-wrap">{{ report.index.text }}</pre>
          </details>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <p class="text-sm text-muted">Справок: {{ report.items?.length ?? 0 }}</p>
          <NewRecord class="ml-auto" :project-id="projectId" type="reference" :records="records" @created="created" />
        </div>

        <p v-if="!report.items?.length" class="text-sm text-muted">
          Справок пока нет. Заведите справку вручную или разберите заметку из входящего: факты о внешней системе — это справка.
        </p>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="text-xs text-muted">
              <tr><th class="pr-3">Номер</th><th class="pr-3">Название</th><th class="pr-3">Вид</th><th class="pr-3">Получено</th><th class="pr-3">Статус</th><th>Что решает</th></tr>
            </thead>
            <tbody>
              <tr v-for="item in report.items" :key="item.id" class="border-t border-default align-top">
                <td class="py-1 pr-3 font-mono text-xs"><NuxtLink :to="`/projects/${projectId}/records/${item.id}`" class="hover:underline">{{ item.id }}</NuxtLink></td>
                <td class="py-1 pr-3">{{ item.title }}</td>
                <td class="py-1 pr-3">{{ KIND_LABEL[item.kind] ?? item.kind }}</td>
                <td class="py-1 pr-3">
                  {{ item.fetched }}
                  <UBadge v-if="item.stale" color="warning" variant="subtle">устарела</UBadge>
                </td>
                <td class="py-1 pr-3"><StatusBadge :status="item.status" /></td>
                <td class="py-1">{{ item.summary || 'описания нет' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </template>
  </div>
</template>
