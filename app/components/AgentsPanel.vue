<script setup lang="ts">
import type { AgentDef, AgentType } from '~~/server/lib/agents';

/**
 * Агенты проекта (R-0091, docs/adr/0033-role-agents.md): файлы `docs/agents/<id>.md`.
 * Создать из типа, изменить промпт, модель и доступ, удалить. Набор по умолчанию —
 * восемь типов одной кнопкой; существующие не перезаписываются.
 */
const props = defineProps<{ projectId: string }>();
const { t } = useT();

interface AgentsResponse { agents: AgentDef[]; problems: { file: string; problem: string }[]; types: AgentType[]; access: string[] }
const { data, refresh } = useFetch<AgentsResponse>(() => `/api/projects/${props.projectId}/agents`, { key: () => `agents:${props.projectId}`, server: false });

const editing = ref<AgentDef | null>(null);
const isNew = ref(false);
const busy = ref(false);
const failure = ref('');

const typeItems = computed(() => (data.value?.types ?? []).map((type) => ({ label: type.title, value: type.type })));
const accessItems = computed(() => (data.value?.access ?? []).map((value) => ({ label: t(`ag.access.${value}`), value })));

function startNew() {
  const first = data.value?.types[0];
  if (!first) return;
  editing.value = { id: '', type: first.type, title: first.title, access: first.access, prompt: first.prompt };
  isNew.value = true;
  failure.value = '';
}
function startEdit(agent: AgentDef) {
  editing.value = { ...agent };
  isNew.value = false;
  failure.value = '';
}
/** Смена типа у нового агента подставляет промпт и доступ типа — дальше их правят. */
function pickType(value: string) {
  const type = data.value?.types.find((item) => item.type === value);
  if (!editing.value || !type) return;
  editing.value = { ...editing.value, type: type.type, ...(isNew.value ? { title: type.title, access: type.access, prompt: type.prompt } : {}) };
}

async function call(run: () => Promise<{ error?: { message: string } } | unknown>) {
  busy.value = true;
  failure.value = '';
  try {
    const response = (await run()) as { error?: { message: string } };
    if (response?.error) { failure.value = response.error.message; return false; }
    await refresh();
    return true;
  } finally {
    busy.value = false;
  }
}

async function save() {
  if (!editing.value) return;
  const body = editing.value;
  if (await call(() => $fetch(`/api/projects/${props.projectId}/agents`, { method: 'POST', body, ignoreResponseError: true }))) editing.value = null;
}
const remove = (id: string) => call(() => $fetch(`/api/projects/${props.projectId}/agents/${id}`, { method: 'DELETE', ignoreResponseError: true }));
const defaults = () => call(() => $fetch(`/api/projects/${props.projectId}/agents/defaults`, { method: 'POST', ignoreResponseError: true }));
</script>

<template>
  <div class="min-w-0 space-y-4 text-sm">
    <p class="text-muted">{{ t('ag.hint') }}</p>
    <div class="flex flex-wrap gap-2">
      <UButton icon="i-lucide-plus" size="sm" @click="startNew">{{ t('ag.new') }}</UButton>
      <UButton icon="i-lucide-users" size="sm" variant="soft" :loading="busy" @click="defaults">{{ t('ag.defaults') }}</UButton>
    </div>
    <p v-if="failure" class="text-error">{{ failure }}</p>

    <ul v-if="data?.agents.length" class="divide-y divide-default rounded-md border border-default">
      <li v-for="agent in data.agents" :key="agent.id" class="flex flex-wrap items-center gap-2 px-3 py-2">
        <UIcon name="i-lucide-bot" class="size-4 text-primary" />
        <span class="font-medium">{{ agent.title }}</span>
        <span class="font-mono text-xs text-muted">{{ agent.id }}</span>
        <UBadge size="sm" variant="outline" color="neutral">{{ agent.type }}</UBadge>
        <UBadge size="sm" variant="soft" color="info">{{ t(`ag.access.${agent.access}`) }}</UBadge>
        <span v-if="agent.model" class="text-xs text-muted">{{ agent.model }}</span>
        <span class="ml-auto flex gap-1">
          <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-pencil" :aria-label="t('ag.edit')" @click="startEdit(agent)" />
          <UButton size="xs" variant="ghost" color="error" icon="i-lucide-trash-2" :aria-label="t('ag.delete')" :loading="busy" @click="remove(agent.id)" />
        </span>
      </li>
    </ul>
    <p v-else class="text-muted">{{ t('ag.none') }}</p>
    <ul v-if="data?.problems.length" class="text-xs text-warning">
      <li v-for="item in data.problems" :key="item.file">{{ item.file }}: {{ item.problem }}</li>
    </ul>

    <UCard v-if="editing">
      <form class="space-y-3" @submit.prevent="save">
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField :label="t('ag.type')"><USelect :model-value="editing.type" :items="typeItems" class="w-full" @update:model-value="(v) => pickType(String(v))" /></UFormField>
          <UFormField :label="t('ag.id')" :help="t('ag.idHelp')"><UInput v-model="editing.id" class="w-full font-mono" :disabled="!isNew" /></UFormField>
          <UFormField :label="t('ag.title')"><UInput v-model="editing.title" class="w-full" /></UFormField>
          <UFormField :label="t('ag.model')" :help="t('ag.modelHelp')"><UInput v-model="editing.model" class="w-full" placeholder="claude-sonnet-5-5" /></UFormField>
          <UFormField :label="t('ag.accessLabel')" class="sm:col-span-2"><USelect v-model="editing.access" :items="accessItems" class="w-full" /></UFormField>
        </div>
        <UFormField :label="t('ag.prompt')"><UTextarea v-model="editing.prompt" :rows="8" class="w-full" /></UFormField>
        <p class="text-xs text-muted">{{ t('ag.limits') }}</p>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="editing = null">{{ t('rel.cancel') }}</UButton>
          <UButton type="submit" :loading="busy" :disabled="!editing.id.trim() || !editing.prompt.trim()">{{ t('ppl.save') }}</UButton>
        </div>
      </form>
    </UCard>
  </div>
</template>
