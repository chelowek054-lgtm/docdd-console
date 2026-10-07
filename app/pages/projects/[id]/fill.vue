<script setup lang="ts">
/**
 * «Наполнение»: вкладки одного экрана, как «Документы» и «Работа» (docs/04-ui.md, «Навигация»).
 * Вкладка живёт в адресе (`?tab=import`): пункт меню открывает свою.
 */
const route = useRoute();
const router = useRouter();

const TABS = [
  { label: 'Входящее', value: 'inbox' },
  { label: 'Импорт', value: 'import' }
];
const KNOWN = ['inbox', 'import'];

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
    <h1 class="text-xl font-semibold">Наполнение</h1>
    <UTabs v-model="tab" :items="TABS" :content="false" />
    <InboxPanel v-if="tab === 'inbox'" />
    <ImportPanel v-else />
  </div>
</template>
