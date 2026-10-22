<script setup lang="ts">
import ModelsPage from '~/pages/models.vue';
import PeoplePage from '~/pages/people.vue';
import { ALL_ACTIONS, ROLE_ACTIONS } from '~~/server/lib/permissions';

/**
 * Настройки консоли (docs/04-ui.md, «Настройки»): окно поверх экрана, как поиск.
 * Вкладки — поиск (чем считать эмбеддинги, состояние индекса), модели (провайдеры
 * и маршруты, тот же экран, что /models) и аккаунты с доступом (учётки, команда
 * проекта, матрица прав ADR-0020).
 */
const props = defineProps<{ projectId: string }>();
const { t } = useT();

const open = ref(false);
const tab = ref<'search' | 'models' | 'access'>('search');
const tabs = computed(() => [
  { label: t('st.search'), value: 'search', icon: 'i-lucide-search' },
  { label: t('st.models'), value: 'models', icon: 'i-lucide-bot' },
  { label: t('st.access'), value: 'access', icon: 'i-lucide-users' }
]);

interface EmbeddingsState { provider: string | null; model: string | null; local: string; candidates: { id: string; label: string; closedData: boolean }[] }
const { data: embeddings, refresh: refreshEmbeddings } = useFetch<EmbeddingsState>('/api/llm/embeddings', { key: 'settings-embeddings', server: false, lazy: true, immediate: false });
const LOCAL = '__local__';
const provider = ref(LOCAL);
const model = ref('');
watch(embeddings, (value) => { provider.value = value?.provider ?? LOCAL; model.value = value?.model ?? ''; });
const providerItems = computed(() => [
  { label: t('st.local'), value: LOCAL },
  ...(embeddings.value?.candidates ?? []).map((item) => ({ label: item.closedData ? item.label : `${item.label} · ${t('st.noClosed')}`, value: item.id }))
]);

const message = ref('');
const busy = ref(false);
async function saveEmbeddings() {
  busy.value = true;
  message.value = '';
  try {
    const response = await $fetch<{ ok?: boolean; error?: { message: string } }>('/api/llm/embeddings', {
      method: 'PUT',
      body: provider.value === LOCAL ? { provider: null } : { provider: provider.value, model: model.value },
      ignoreResponseError: true
    });
    message.value = response.error ? response.error.message : t('st.saved');
    await refreshEmbeddings();
  } finally {
    busy.value = false;
  }
}

interface IndexState { model: string; blocks: number; ms: number }
const indexState = ref<IndexState | null>(null);
async function indexAction(rebuild: boolean) {
  if (!props.projectId) return;
  busy.value = true;
  try {
    indexState.value = await $fetch<IndexState>(`/api/projects/${props.projectId}/search`, { method: 'POST', body: { rebuild } });
  } finally {
    busy.value = false;
  }
}

watch(open, (value) => {
  if (!value) return;
  void refreshEmbeddings();
  if (props.projectId) void indexAction(false);
});
</script>

<template>
  <UButton icon="i-lucide-settings" :aria-label="t('st.aria')" variant="ghost" color="neutral" size="sm" @click="open = true" />
  <UModal v-model:open="open" :title="t('st.title')" :ui="{ content: 'sm:max-w-4xl' }">
    <template #body>
      <UTabs v-model="tab" :items="tabs" :content="false" class="mb-4" />

      <div v-if="tab === 'search'" class="space-y-4 text-sm">
        <p class="text-muted">{{ t('st.searchHint') }}</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField :label="t('st.provider')">
            <USelect v-model="provider" :items="providerItems" class="w-full" />
          </UFormField>
          <UFormField v-if="provider !== LOCAL" :label="t('st.model')" :help="t('st.modelHelp')">
            <UInput v-model="model" placeholder="text-embedding-3-small" class="w-full" />
          </UFormField>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton :loading="busy" @click="saveEmbeddings">{{ t('st.save') }}</UButton>
          <span v-if="message" class="text-muted">{{ message }}</span>
        </div>
        <div v-if="props.projectId" class="ds-card ds-card--bordered space-y-2 p-3">
          <p class="font-medium">{{ t('st.index') }}</p>
          <p v-if="indexState" class="text-muted">{{ t('st.indexState', { model: indexState.model, blocks: indexState.blocks, ms: indexState.ms }) }}</p>
          <p class="text-xs text-muted">{{ t('st.indexFresh') }}</p>
          <UButton size="sm" variant="soft" icon="i-lucide-refresh-cw" :loading="busy" @click="indexAction(true)">{{ t('st.rebuild') }}</UButton>
        </div>
      </div>

      <ModelsPage v-else-if="tab === 'models'" />

      <div v-else class="space-y-6">
        <PeoplePage />
        <TeamCard v-if="props.projectId" :project-id="props.projectId" />
        <div>
          <p class="mb-2 font-medium">{{ t('st.matrix') }}</p>
          <div class="overflow-x-auto">
            <table class="ds-table w-full text-sm">
              <thead>
                <tr>
                  <th class="text-left">{{ t('st.role') }}</th>
                  <th v-for="action in ALL_ACTIONS" :key="action" class="text-center">{{ action }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(actions, role) in ROLE_ACTIONS" :key="role">
                  <td>{{ t(`role.${role}`) }}</td>
                  <td v-for="action in ALL_ACTIONS" :key="action" class="text-center">
                    <UIcon v-if="actions.includes(action)" name="i-lucide-check" class="size-4 text-success" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p class="mt-1 text-xs text-muted">{{ t('st.matrixHint') }}</p>
        </div>
      </div>
    </template>
  </UModal>
</template>
