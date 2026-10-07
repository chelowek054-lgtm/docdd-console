<script setup lang="ts">
/**
 * «Сверка»: вкладки одного экрана, как «Документы» и «Работа» (docs/04-ui.md, «Навигация»).
 * Вкладка живёт в адресе (`?tab=results`): пункт меню открывает свою.
 */
const route = useRoute();
const router = useRouter();

const TABS = [
  { label: 'Проверки', value: 'checks' },
  { label: 'Результат', value: 'results' },
  { label: 'Нарушения', value: 'issues' },
  { label: 'Граф', value: 'graph' }
];
const KNOWN = ['checks', 'results', 'issues', 'graph'];

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
    <h1 class="text-xl font-semibold">Сверка</h1>
    <UTabs v-model="tab" :items="TABS" :content="false" />
    <ChecksPanel v-if="tab === 'checks'" />
    <ResultsPanel v-else-if="tab === 'results'" />
    <IssuesPanel v-else-if="tab === 'issues'" />
    <GraphPanel v-else />
  </div>
</template>
