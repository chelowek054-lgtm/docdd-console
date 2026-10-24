<script setup lang="ts">
/**
 * «Работа»: задачи и фазы на одном экране, как «Документы» (docs/04-ui.md, «Работа: задачи и
 * фазы на одном экране»). Вкладка живёт в адресе (`?tab=phases`): пункт меню открывает свою.
 */
const route = useRoute();
const router = useRouter(); const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { index, records, refresh } = useProjectIndex(projectId);
const { mode, ranked, set: setOrder } = useOrderMode(records);
const titles = computed(() => Object.fromEntries(records.value.map((record) => [record.id, record.title])));

const TABS = computed(() => [
  { label: t('nav.tasks'), value: 'tasks' },
  { label: t('nav.phases'), value: 'phases' }
]);

const tab = computed({
  get: () => (route.query['tab'] === 'phases' ? 'phases' : 'tasks'),
  // Статус и фильтры принадлежат вкладке: на другой они значили бы не то.
  set: (value: string | number) => { router.replace({ query: { tab: String(value) } }); }
});
</script>

<template>
  <div class="space-y-5">
    <h1 class="text-xl font-semibold">{{ t('nav.work') }}</h1>
    <div class="flex flex-wrap items-center gap-3">
      <!-- Просит модель расставить фазы, а внутри них задачи; ничего не пишет, пока человек не применит порядок. -->
      <PromptPanel
        :project-id="projectId"
        kind="priority"
        :label="t('work.sort')"
        :hint="t('work.sortHint')"
      >
        <template #answer="{ answer }">
          <PriorityPreview :project-id="projectId" :answer="answer" :titles="titles" :roles="index?.project.roles ?? []" @applied="refresh" />
        </template>
      </PromptPanel>
      <div v-if="ranked" class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-muted">{{ t('work.order') }}</span>
        <UButton size="xs" :variant="mode === 'importance' ? 'solid' : 'ghost'" color="neutral" @click="setOrder('importance')">{{ t('work.byImportance') }}</UButton>
        <UButton size="xs" :variant="mode === 'id' ? 'solid' : 'ghost'" color="neutral" @click="setOrder('id')">{{ t('work.byId') }}</UButton>
      </div>
    </div>
    <!-- Вкладки группы — строкой под шапкой (docs/04-ui.md, «Навигация»). -->
    <TasksPanel v-if="tab === 'tasks'" />
    <PhasesPanel v-else />
  </div>
</template>
