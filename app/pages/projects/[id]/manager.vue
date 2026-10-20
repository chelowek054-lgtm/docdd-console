<script setup lang="ts">
/**
 * Рабочее место менеджера проекта (docs/15-team-platform.md, фаза 29): доска,
 * дорожная карта, сводка для заказчика и помощник. Всё считается из записей.
 */
const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { index, records, refresh } = useProjectIndex(projectId);

const TABS = [
  { label: 'Доска', value: 'board' },
  { label: 'Дорожная карта', value: 'roadmap' },
  { label: 'Сводка', value: 'summary' },
  { label: 'Помощник', value: 'assistant' }
];
const tab = computed({
  get: () => (TABS.some((item) => item.value === route.query['tab']) ? String(route.query['tab']) : 'board'),
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-xl font-semibold">Менеджер</h1>
    <UTabs v-model="tab" :items="TABS" :content="false" />
    <ManagerBoard v-if="tab === 'board'" :project-id="projectId" :records="records" @changed="refresh()" />
    <ManagerRoadmap v-else-if="tab === 'roadmap'" :project-id="projectId" :records="records" @changed="refresh()" />
    <ManagerSummary v-else-if="tab === 'summary'" :project-id="projectId" :project-name="index?.project.name ?? projectId" :records="records" />
    <ManagerAssistant v-else :project-id="projectId" :records="records" />
  </div>
</template>
