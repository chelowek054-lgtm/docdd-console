<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ContrastRow, DesignCheck, DesignTokens } from '~~/server/lib/design';
import type { StackId } from '~~/server/lib/design-export';

/**
 * «Дизайн» проекта (docs/04-ui.md, «Дизайн»; docs/16-design-system.md): токены
 * после сложения «общее → локальное», реестр компонентов, конструктор тем,
 * выгрузка в стеки, конструкторы форм и таблиц, импорт из Figma и проверка
 * экранов. Режим «дизайнер» прячет инженерное (выгрузка, конструкторы, импорт и
 * имена переменных), «разработчик» его показывает; выбор помнит браузер.
 * Вкладка живёт в адресе (`?tab=`), как у «Работы» и «Сверки».
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
  stacks?: { id: StackId; label: string }[];
}

const route = useRoute();
const router = useRouter();
const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { data } = useFetch<DesignResponse | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/design`,
  { key: () => `design:${projectId.value}` }
);
const failure = computed(() => failureOf(data.value));
const design = computed(() => (failure.value ? null : (data.value as DesignResponse | null)));

type Mode = 'designer' | 'developer';
const MODE_KEY = 'docdd-design-mode';
const mode = useState<Mode>('design-mode', () => 'designer');
onMounted(() => {
  // Выбор живёт в браузере: на сервере он неизвестен, а недоступное хранилище — не повод падать.
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'designer' || stored === 'developer') mode.value = stored;
  } catch {
    // Приватное окно или запрет хранилища: режим просто не запомнится.
  }
});
watch(mode, (value) => {
  try {
    localStorage.setItem(MODE_KEY, value);
  } catch {
    // см. выше
  }
});

const tabs = computed(() => [
  { label: t('dp.tab.tokens'), value: 'tokens' },
  { label: t('dp.tab.components'), value: 'components' },
  { label: t('dp.tab.themes'), value: 'themes' },
  ...(mode.value === 'developer'
    ? [
        { label: t('dp.tab.stacks'), value: 'stacks' },
        { label: t('dp.tab.constructors'), value: 'constructors' },
        { label: t('dp.tab.figma'), value: 'figma' }
      ]
    : []),
  { label: t('dp.tab.screens'), value: 'screens' }
]);

const tab = computed({
  get: () => {
    const value = route.query['tab'];
    const known = tabs.value.map((item) => item.value);
    return typeof value === 'string' && known.includes(value) ? value : 'tokens';
  },
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else-if="design">
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">{{ t('nav.design') }}</h1>
        <NuxtLink to="/design" class="text-sm text-muted hover:underline">{{ t('dp.global') }}</NuxtLink>
        <div class="ml-auto flex items-center gap-1" role="group" :aria-label="t('dp.mode')">
          <UButton
            size="sm"
            color="neutral"
            :variant="mode === 'designer' ? 'soft' : 'ghost'"
            :aria-pressed="mode === 'designer'"
            @click="mode = 'designer'"
          >
            {{ t('dp.mode.designer') }}
          </UButton>
          <UButton
            size="sm"
            color="neutral"
            :variant="mode === 'developer' ? 'soft' : 'ghost'"
            :aria-pressed="mode === 'developer'"
            @click="mode = 'developer'"
          >
            {{ t('dp.mode.developer') }}
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="design.empty"
        color="neutral"
        variant="subtle"
        icon="i-lucide-palette"
        :title="t('dp.empty.title')"
        :description="t('dp.empty.text')"
      >
        <template #actions>
          <UButton :to="`/projects/${projectId}/shared`" size="sm" variant="soft">{{ t('nav.practices') }}</UButton>
        </template>
      </UAlert>

      <template v-else>
        <p class="text-sm text-muted">
          {{ t('dp.sources') }}
          <span v-for="(source, at) in design.sources" :key="source.id">
            <span class="font-mono text-xs">{{ source.id }}</span> ({{ source.level === 'general' ? t('dp.level.general') : t('dp.level.local') }})<span v-if="at < design.sources.length - 1">, </span>
          </span>
          <template v-if="!design.connected"> · {{ t('dp.notConnected') }}</template>
        </p>

        <UAlert
          v-for="conflict in design.conflicts"
          :key="conflict.key"
          color="warning"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          :title="t('dp.conflict', { key: conflict.key })"
          :description="t('dp.conflict.text', { records: conflict.records.join(' / ') })"
        />

        <UTabs v-model="tab" :items="tabs" :content="false" />
        <DesignTokens
          v-if="tab === 'tokens'"
          :tokens="design.tokens"
          :contrast="design.contrast"
          :checks="design.checks"
          :developer="mode === 'developer'"
        />
        <DesignComponents v-else-if="tab === 'components'" :tokens="design.tokens" :missing="design.componentsMissing ?? null" :project-id="projectId" />
        <DesignThemeBuilder v-else-if="tab === 'themes'" :project-id="projectId" :tokens="design.tokens" />
        <DesignStacks v-else-if="tab === 'stacks'" :project-id="projectId" />
        <DesignConstructors
          v-else-if="tab === 'constructors'"
          :locales="design.tokens.i18n.locales.map((item) => item.value)"
          :stacks="(design.stacks ?? []).map((item) => item.id)"
        />
        <DesignFigma v-else-if="tab === 'figma'" :project-id="projectId" :tokens="design.tokens" />
        <DesignScreens v-else :project-id="projectId" />
      </template>
    </template>
  </div>
</template>
