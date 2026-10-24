<script setup lang="ts">
/**
 * «Наполнение»: вкладки одного экрана, как «Документы» и «Работа» (docs/04-ui.md, «Навигация»).
 * Вкладка живёт в адресе (`?tab=import`): пункт меню открывает свою.
 */
const route = useRoute();
const router = useRouter(); const { t } = useT();

const TABS = computed(() => [
  { label: t('nav.inbox'), value: 'inbox' },
  { label: t('nav.import'), value: 'import' },
  { label: t('nav.onboarding'), value: 'onboarding' },
  { label: 'Jira', value: 'jira' },
  { label: 'Confluence', value: 'confluence' }
]);
const KNOWN = ['inbox', 'import', 'onboarding', 'jira', 'confluence'];

const tab = computed({
  get: () => {
    const value = route.query['tab'];
    return typeof value === 'string' && KNOWN.includes(value) ? value : 'inbox';
  },
  // Фильтры и отметки принадлежат вкладке: на другой они значили бы не то.
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-xl font-semibold">{{ t('nav.fill') }}</h1>
    <!-- Вкладки группы — строкой под шапкой (docs/04-ui.md, «Навигация»). -->
    <InboxPanel v-if="tab === 'inbox'" />
    <div v-else-if="tab === 'onboarding'" class="space-y-5"><NewProjectWizard v-if="route.query['scenario'] === 'new'" :project-id="String(route.params['id'] ?? '')" /><AsIsPanel v-else :project-id="String(route.params['id'] ?? '')" /><OnboardingChecklist :project-id="String(route.params['id'] ?? '')" /><SourcesFinder :project-id="String(route.params['id'] ?? '')" /><TestChecksPanel :project-id="String(route.params['id'] ?? '')" /></div>
    <ExternalImportPanel v-else-if="tab === 'jira' || tab === 'confluence'" :key="tab" :source="tab" />
    <ImportPanel v-else />
  </div>
</template>
