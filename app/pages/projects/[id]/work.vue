<script setup lang="ts">
/**
 * «Работа»: задачи и фазы на одном экране, как «Документы» (docs/04-ui.md, «Работа: задачи и
 * фазы на одном экране»). Вкладка живёт в адресе (`?tab=phases`): пункт меню открывает свою.
 */
const route = useRoute();
const router = useRouter();

const TABS = [
  { label: 'Задачи', value: 'tasks' },
  { label: 'Фазы', value: 'phases' }
];

const tab = computed({
  get: () => (route.query['tab'] === 'phases' ? 'phases' : 'tasks'),
  // Статус и фильтры принадлежат вкладке: на другой они значили бы не то.
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-xl font-semibold">Работа</h1>
    <UTabs v-model="tab" :items="TABS" :content="false" />
    <TasksPanel v-if="tab === 'tasks'" />
    <PhasesPanel v-else />
  </div>
</template>
