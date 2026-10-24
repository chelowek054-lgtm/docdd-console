<script setup lang="ts">
/**
 * «Сверка»: вкладки одного экрана, как «Документы» и «Работа» (docs/04-ui.md, «Навигация»).
 * Вкладка живёт в адресе (`?tab=results`): пункт меню открывает свою.
 */
const route = useRoute();
const router = useRouter(); const { t } = useT();

const TABS = computed(() => [
  { label: t('nav.checks'), value: 'checks' },
  { label: t('nav.run'), value: 'run' },
  { label: t('nav.results'), value: 'results' },
  { label: t('nav.issues'), value: 'issues' },
  { label: t('nav.graph'), value: 'graph' }
]);
const KNOWN = ['checks', 'results', 'issues', 'graph', 'run'];

const tab = computed({
  get: () => {
    const value = route.query['tab'];
    return typeof value === 'string' && KNOWN.includes(value) ? value : 'checks';
  },
  // Фильтры и отметки принадлежат вкладке: на другой они значили бы не то.
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-xl font-semibold">{{ t('nav.verify') }}</h1>
    <!-- Вкладки группы — строкой под шапкой (docs/04-ui.md, «Навигация»). -->
    <ChecksPanel v-if="tab === 'checks'" />
    <ResultsPanel v-else-if="tab === 'results'" />
    <IssuesPanel v-else-if="tab === 'issues'" />
    <RunPanel v-else-if="tab === 'run'" />
    <GraphPanel v-else />
  </div>
</template>
