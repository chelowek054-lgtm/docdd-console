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
/**
 * Разделы — аккордеоном: сначала заголовки с описанием; выбран раздел — список
 * уходит влево узкой колонкой, справа его настройки, переключаться можно оттуда же.
 */
type Section = 'search' | 'models' | 'access';
const section = ref<Section | null>(null);
const sections = computed(() => [
  { value: 'search' as const, label: t('st.search'), hint: t('st.searchShort'), icon: 'i-lucide-search' },
  { value: 'models' as const, label: t('st.models'), hint: t('st.modelsShort'), icon: 'i-lucide-bot' },
  { value: 'access' as const, label: t('st.access'), hint: t('st.accessShort'), icon: 'i-lucide-users' }
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
    message.value = t('st.rebuilt', { blocks: indexState.value.blocks, ms: indexState.value.ms });
  } finally {
    busy.value = false;
  }
}

watch(open, (value) => {
  if (!value) { section.value = null; return; }
  void refreshEmbeddings();
});
</script>

<template>
  <UButton icon="i-lucide-settings" :aria-label="t('st.aria')" variant="ghost" color="neutral" size="sm" @click="open = true" />
  <UModal v-model:open="open" :title="t('st.title')" :ui="{ content: 'sm:max-w-4xl' }">
    <template #body>
      <!-- Аккордеон: заголовки во всю ширину, пока раздел не выбран. -->
      <Transition name="ds-fade" mode="out-in">
      <ul v-if="!section" key="list" class="space-y-2">
        <li v-for="item in sections" :key="item.value">
          <button type="button" class="ds-card ds-card--bordered flex w-full items-center gap-3 p-4 text-left hover:bg-elevated" @click="section = item.value">
            <UIcon :name="item.icon" class="size-5 shrink-0 text-primary" />
            <span class="min-w-0 flex-1">
              <span class="block font-medium">{{ item.label }}</span>
              <span class="block text-sm text-muted">{{ item.hint }}</span>
            </span>
            <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
          </button>
        </li>
      </ul>

      <!-- Раздел выбран: аккордеон — узкой колонкой слева, настройки — справа. -->
      <div v-else key="grid" class="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
        <nav class="flex gap-1 sm:flex-col" :aria-label="t('st.title')">
          <button
            v-for="item in sections"
            :key="item.value"
            type="button"
            class="flex items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm"
            :class="section === item.value ? 'bg-primary/10 font-medium text-primary' : 'text-muted hover:bg-elevated hover:text-default'"
            @click="section = item.value"
          >
            <UIcon :name="item.icon" class="size-4 shrink-0" />
            <span class="truncate">{{ item.label }}</span>
          </button>
        </nav>

        <Transition name="ds-fade" mode="out-in">
          <div v-if="section === 'search'" key="search" class="min-w-0 space-y-4 text-sm">
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
              <UButton v-if="props.projectId" variant="soft" icon="i-lucide-refresh-cw" :loading="busy" @click="indexAction(true)">{{ t('st.rebuild') }}</UButton>
              <span v-if="message" class="text-muted">{{ message }}</span>
            </div>
          </div>

          <div v-else-if="section === 'models'" key="models" class="min-w-0"><ModelsPage /></div>

          <div v-else key="access" class="min-w-0 space-y-6">
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
        </Transition>
      </div>
      </Transition>
    </template>
  </UModal>
</template>
