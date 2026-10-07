<script setup lang="ts">
/**
 * «Работа»: задачи и фазы на одном экране, как «Документы» (docs/04-ui.md, «Работа: задачи и
 * фазы на одном экране»). Вкладка живёт в адресе (`?tab=phases`): пункт меню открывает свою.
 */
const route = useRoute();
const router = useRouter();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { index, records, refresh } = useProjectIndex(projectId);
const { mode, ranked, set: setOrder } = useOrderMode(records);
const titles = computed(() => Object.fromEntries(records.value.map((record) => [record.id, record.title])));

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
    <div class="flex flex-wrap items-center gap-3">
      <!-- Просит модель расставить фазы, а внутри них задачи; ничего не пишет, пока человек не применит порядок. -->
      <PromptPanel
        :project-id="projectId"
        kind="priority"
        label="Сортировать по важности"
        hint="Ответ — порядок фаз и задач: пишется только после «Применить порядок»"
      >
        <template #answer="{ answer }">
          <PriorityPreview :project-id="projectId" :answer="answer" :titles="titles" :roles="index?.project.roles ?? []" @applied="refresh" />
        </template>
      </PromptPanel>
      <div v-if="ranked" class="ml-auto flex items-center gap-2 text-sm">
        <span class="text-muted">Порядок:</span>
        <UButton size="xs" :variant="mode === 'importance' ? 'solid' : 'ghost'" color="neutral" @click="setOrder('importance')">по важности</UButton>
        <UButton size="xs" :variant="mode === 'id' ? 'solid' : 'ghost'" color="neutral" @click="setOrder('id')">по номеру</UButton>
      </div>
    </div>
    <UTabs v-model="tab" :items="TABS" :content="false" />
    <TasksPanel v-if="tab === 'tasks'" />
    <PhasesPanel v-else />
  </div>
</template>
