<script setup lang="ts">
/**
 * Рабочее место менеджера проекта (docs/15-team-platform.md, фаза 29): доска,
 * дорожная карта, сводка для заказчика и помощник. Всё считается из записей.
 */
const route = useRoute();
const router = useRouter(); const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { index, records, refresh } = useProjectIndex(projectId);

const TABS = computed(() => [
  { label: t('mgr.board'), value: 'board' },
  { label: t('mgr.roadmap'), value: 'roadmap' },
  { label: t('mgr.summary'), value: 'summary' },
  { label: t('mgr.assistant'), value: 'assistant' }
]);
const tab = computed({
  get: () => (TABS.value.some((item) => item.value === route.query['tab']) ? String(route.query['tab']) : 'board'),
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-xl font-semibold">{{ t('mgr.title') }}</h1>
    <UTabs v-model="tab" :items="TABS" :content="false" />
    <ManagerBoard v-if="tab === 'board'" :project-id="projectId" :records="records" @changed="refresh()" />
    <ManagerRoadmap v-else-if="tab === 'roadmap'" :project-id="projectId" :records="records" @changed="refresh()" />
    <ManagerSummary v-else-if="tab === 'summary'" :project-id="projectId" :project-name="index?.project.name ?? projectId" :records="records" />
    <ManagerAssistant v-else :project-id="projectId" :records="records" />
  </div>
</template>
