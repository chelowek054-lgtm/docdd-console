<script setup lang="ts">
import type { AgentDef, AgentType } from '~~/server/lib/agents';

const props = defineProps<{ projectId: string; taskId?: string }>();
const { t, locale } = useT();
const createOpen = ref(false);
const { byId } = useProjectIndex(() => props.projectId);
const task = computed(() => props.taskId ? byId.value.get(props.taskId) : undefined);
const assignee = computed(() => {
  const value = task.value?.extra['assignee'];
  return typeof value === 'string' ? value : '';
});

interface AgentsResponse {
  agents: AgentDef[];
  types: AgentType[];
  problems: { file: string; problem: string }[];
}

const { data, error, pending, refresh } = useFetch<AgentsResponse>(
  () => `/api/projects/${encodeURIComponent(props.projectId)}/agents`,
  { server: false }
);

const rolesByType = computed(() => new Map(data.value?.types.map(({ type, role }) => [type, role])));
const agentRole = (type: string) => {
  const role = rolesByType.value.get(type);
  if (!role) return type;
  const key = `role.${role}`;
  const label = t(key);
  return label === key ? role : label;
};

const labels = computed(() => locale.value === 'en'
  ? { failed: 'Could not load project agents.', unassigned: 'Unassigned', empty: 'No agents are configured for this project.' }
  : { failed: 'Не удалось загрузить агентов проекта.', unassigned: 'Не назначен', empty: 'Для этого проекта агенты ещё не настроены.' });
</script>

<template>
  <div class="min-w-0 space-y-4 p-4 text-sm">
    <div class="flex justify-end">
      <UButton v-can="'team'" icon="i-lucide-plus" size="sm" variant="soft" @click="createOpen = true">{{ t('ag.add') }}</UButton>
    </div>
    <UModal v-model:open="createOpen" :title="t('ag.add')" :ui="{ content: 'sm:max-w-2xl' }">
      <template #body>
        <AgentsPanel v-if="createOpen" :project-id="projectId" create-only
          @saved="createOpen = false; refresh()" @cancel="createOpen = false" />
      </template>
    </UModal>
    <div v-if="task?.type === 'task'" class="rounded-md border border-default p-3">
      <p class="text-xs text-muted"><span class="font-mono">{{ task.id }}</span> · {{ task.title }}</p>
      <p class="mt-1">{{ t('as.title') }} · <span class="font-medium">{{ assignee || labels.unassigned }}</span></p>
    </div>

    <p v-if="pending" role="status" class="text-muted">{{ t('ref.loading') }}</p>
    <div v-else-if="error" class="flex flex-wrap items-center gap-2">
      <p role="alert" class="text-error">{{ labels.failed }}</p>
      <UButton size="xs" color="neutral" variant="soft" @click="refresh()">{{ t('chat.retry') }}</UButton>
    </div>
    <template v-else-if="data">
      <ul v-if="data.agents.length" class="divide-y divide-default rounded-md border border-default" :aria-label="t('ag.section')">
        <li v-for="agent in data.agents" :key="agent.id" class="flex flex-wrap items-center gap-2 px-3 py-2">
          <UIcon name="i-lucide-bot" class="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span class="font-medium">{{ agent.title }}</span>
          <span class="font-mono text-xs text-muted">{{ agent.id }}</span>
          <UBadge size="sm" variant="outline" color="neutral">{{ agentRole(agent.type) }}</UBadge>
          <UBadge size="sm" variant="soft" color="info">{{ t(`ag.access.${agent.access}`) }}</UBadge>
          <span v-if="agent.model" class="break-all text-xs text-muted">{{ agent.model }}</span>
        </li>
      </ul>
      <p v-else class="text-muted">{{ labels.empty }}</p>
      <ul v-if="data.problems.length" class="text-xs text-warning">
        <li v-for="item in data.problems" :key="item.file">{{ item.file }} · {{ item.problem }}</li>
      </ul>
    </template>
  </div>
</template>
