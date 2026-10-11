<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ContrastRow, DesignCheck, DesignTokens } from '~~/server/lib/design';

/**
 * «Дизайн» проекта (docs/04-ui.md, «Дизайн»; docs/16-design-system.md): токены
 * после сложения «общее → локальное», реестр компонентов, выгрузка в стеки и
 * проверка экранов. Вкладка живёт в адресе (`?tab=`), как у «Работы» и «Сверки».
 */
interface DesignResponse {
  tokens: DesignTokens;
  checks: DesignCheck[];
  contrast: ContrastRow[];
  conflicts: { key: string; records: string[] }[];
  sources: { id: string; level: 'general' | 'local' }[];
  empty: boolean;
  connected: boolean;
  /** Компоненты реестра, которых нет в коде; `null` — сверять не с чем. */
  componentsMissing?: string[] | null;
}

const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { data } = useFetch<DesignResponse | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/design`,
  { key: () => `design:${projectId.value}` }
);
const failure = computed(() => failureOf(data.value));
const design = computed(() => (failure.value ? null : (data.value as DesignResponse | null)));

const TABS = [
  { label: 'Токены', value: 'tokens' },
  { label: 'Компоненты', value: 'components' },
  { label: 'Стеки', value: 'stacks' },
  { label: 'Экраны', value: 'screens' }
];
const KNOWN = TABS.map((tab) => tab.value);

const tab = computed({
  get: () => {
    const value = route.query['tab'];
    return typeof value === 'string' && KNOWN.includes(value) ? value : 'tokens';
  },
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else-if="design">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Дизайн</h1>
        <NuxtLink to="/design" class="text-sm text-muted hover:underline">Эталон консоли и все проекты</NuxtLink>
      </div>

      <UAlert
        v-if="design.empty"
        color="neutral"
        variant="subtle"
        icon="i-lucide-palette"
        title="Дизайн не подключён"
        description="У проекта нет подтверждённого блока docdd-design: ни общего, ни своего. Подключите тег design у встроенного источника на экране «Практики»."
      >
        <template #actions>
          <UButton :to="`/projects/${projectId}/shared`" size="sm" variant="soft">Практики</UButton>
        </template>
      </UAlert>

      <template v-else>
        <p class="text-sm text-muted">
          Источники:
          <span v-for="(source, at) in design.sources" :key="source.id">
            <span class="font-mono text-xs">{{ source.id }}</span> ({{ source.level === 'general' ? 'общий' : 'проект' }})<span v-if="at < design.sources.length - 1">, </span>
          </span>
          <template v-if="!design.connected"> · общий эталон не подключён, действует только своё</template>
        </p>

        <UAlert
          v-for="conflict in design.conflicts"
          :key="conflict.key"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="`Противоречие: ${conflict.key}`"
          :description="`Записи ${conflict.records.join(' и ')} задают разное; действует поздняя.`"
        />

        <UTabs v-model="tab" :items="TABS" :content="false" />
        <DesignTokens v-if="tab === 'tokens'" :tokens="design.tokens" :contrast="design.contrast" :checks="design.checks" />
        <DesignComponents v-else-if="tab === 'components'" :tokens="design.tokens" :missing="design.componentsMissing ?? null" />
        <DesignStacks v-else-if="tab === 'stacks'" :project-id="projectId" />
        <DesignScreens v-else :project-id="projectId" />
      </template>
    </template>
  </div>
</template>
