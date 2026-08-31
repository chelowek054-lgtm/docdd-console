<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ProjectMap } from '~~/server/lib/maps';

const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

type MapResponse = ProjectMap & { unverified: number };

const { data } = useFetch<MapResponse | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/map`,
  { key: () => `map:${projectId.value}` }
);

const failure = computed(() => failureOf(data.value));
const map = computed(() => (failure.value ? null : (data.value as MapResponse | null)));

const views = computed(() => {
  const value = map.value;
  if (!value) return [];
  return [
    {
      key: 'codemap',
      title: 'Кодовая база',
      question: 'Из чего состоит проект и что на что опирается',
      count: `${value.codemap.modules.length} модулей, ${value.codemap.imports.length} связей`,
      source: codemapMermaid(value)
    },
    {
      key: 'dataflow',
      title: 'Потоки данных',
      question: 'Откуда данные приходят, где лежат и куда уходят',
      count: `${value.dataflow.sources.length} источников, ${value.dataflow.flows.length} потоков`,
      source: dataflowMermaid(value)
    },
    {
      key: 'userflow',
      title: 'Пользовательские пути',
      question: 'Какие экраны есть, как между ними ходят и что каждый дёргает',
      count: `${value.userflow.screens.length} экранов, ${value.userflow.calls.length} вызовов`,
      source: userflowMermaid(value)
    }
  ];
});

const shown = ref<'codemap' | 'dataflow' | 'userflow'>('codemap');
const current = computed(() => views.value.find((view) => view.key === shown.value));

const copied = ref(false);
async function copySource() {
  const source = current.value?.source;
  if (!source) return;
  await navigator.clipboard.writeText(source);
  copied.value = true;
  setTimeout(() => { copied.value = false; }, 2000);
}
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Карты проекта</h1>
        <p v-if="map" class="text-sm text-muted">
          сложено из {{ plural(map.from.length, 'карты', 'карт', 'карт') }}
        </p>
        <UBadge v-if="map && map.unverified > 0" color="error" variant="subtle" class="ml-auto">
          {{ map.unverified }} утверждений не прошли сверку
        </UBadge>
      </div>

      <p class="text-sm text-muted">
        Картина складывается из подтверждённых карт изменений. Черновики сюда не
        входят: пока человек не подтвердил, это намерение, а не устройство проекта.
      </p>

      <div
        v-if="map && map.from.length === 0"
        class="rounded-lg border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        Подтверждённых карт нет — складывать нечего. Карта заводится записью типа
        <code>map</code> и запрашивается у модели по шаблону из <code>docs/prompts/</code>.
      </div>

      <template v-else-if="map">
        <div class="flex flex-wrap gap-2">
          <UButton
            v-for="view in views"
            :key="view.key"
            size="sm"
            :variant="shown === view.key ? 'solid' : 'outline'"
            :color="shown === view.key ? 'primary' : 'neutral'"
            @click="shown = view.key as typeof shown"
          >
            {{ view.title }}
          </UButton>
        </div>

        <UCard v-if="current">
          <template #header>
            <div class="flex flex-wrap items-center gap-3">
              <div>
                <h2 class="font-medium">{{ current.title }}</h2>
                <p class="text-sm text-muted">{{ current.question }}</p>
              </div>
              <p class="ml-auto text-sm text-muted">{{ current.count }}</p>
              <UButton
                v-if="current.source"
                size="sm"
                variant="ghost"
                color="neutral"
                icon="i-lucide-copy"
                @click="copySource"
              >
                {{ copied ? 'Скопировано' : 'Скопировать mermaid' }}
              </UButton>
            </div>
          </template>

          <p v-if="!current.source" class="text-sm text-muted">
            В подтверждённых картах эта структура не описана.
          </p>
          <MermaidDiagram v-else :source="current.source" :id="`map-${current.key}`" />
        </UCard>
      </template>
    </template>
  </div>
</template>
