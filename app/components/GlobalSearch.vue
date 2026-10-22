<script setup lang="ts">
/**
 * Глобальный смысловой поиск (docs/adr/0031-semantic-search.md): окно поверх
 * текущего экрана, а не страница. Пока запрос не введён — ни одного запроса к
 * серверу. Результат — ссылка на запись и её раздел.
 */
const props = defineProps<{ projectId: string }>();
const { t } = useT();

interface SearchHit { key: string; recordId: string; type: string; title: string; heading: string; snippet: string; score: number; to: string }

const open = ref(false);
const query = ref('');
const hits = ref<SearchHit[]>([]);
const busy = ref(false);
const failed = ref('');

defineShortcuts({ meta_k: () => { open.value = true; } });

let timer: ReturnType<typeof setTimeout> | undefined;
let seq = 0;
watch(query, (value) => {
  clearTimeout(timer);
  failed.value = '';
  if (!value.trim()) { hits.value = []; busy.value = false; return; }
  busy.value = true;
  // Задержка — чтобы не считать сходство на каждую букву.
  timer = setTimeout(async () => {
    const mine = ++seq;
    try {
      const response = await $fetch<{ hits: SearchHit[] }>(`/api/projects/${props.projectId}/search/semantic`, { query: { q: value, limit: 12 } });
      if (mine === seq) hits.value = response.hits;
    } catch (error) {
      if (mine === seq) failed.value = String((error as { data?: { error?: { message?: string } } }).data?.error?.message ?? error);
    } finally {
      if (mine === seq) busy.value = false;
    }
  }, 250);
});

watch(open, (value) => { if (!value) { query.value = ''; hits.value = []; } });

const percent = (score: number) => `${Math.round(Math.max(0, score) * 100)}%`;
</script>

<template>
  <UButton
    icon="i-lucide-search"
    :aria-label="t('gs.aria')"
    variant="ghost"
    color="neutral"
    size="sm"
    @click="open = true"
  />
  <UModal v-model:open="open" :title="t('gs.title')" :description="t('gs.hint')" :ui="{ content: 'sm:max-w-2xl' }">
    <template #body>
      <UInput
        v-model="query"
        autofocus
        icon="i-lucide-search"
        :loading="busy"
        :placeholder="t('gs.placeholder')"
        class="w-full"
        size="lg"
      />
      <p v-if="failed" class="mt-3 text-sm text-error">{{ failed }}</p>
      <p v-else-if="query.trim() && !busy && !hits.length" class="mt-3 text-sm text-muted">{{ t('gs.empty') }}</p>
      <ul v-if="hits.length" class="mt-3 max-h-[60vh] space-y-1 overflow-y-auto">
        <li v-for="hit in hits" :key="hit.key">
          <NuxtLink :to="hit.to" class="block rounded-md px-3 py-2 hover:bg-elevated" @click="open = false">
            <div class="flex items-center gap-2 text-sm">
              <span class="font-mono text-xs text-muted">{{ hit.type === 'note' ? t('gs.note') : hit.recordId }}</span>
              <span class="min-w-0 flex-1 truncate font-medium">{{ hit.title }}<span v-if="hit.heading" class="text-muted"> · {{ hit.heading }}</span></span>
              <span class="shrink-0 text-xs text-muted">{{ percent(hit.score) }}</span>
            </div>
            <p class="mt-0.5 line-clamp-2 text-xs text-muted">{{ hit.snippet }}</p>
          </NuxtLink>
        </li>
      </ul>
    </template>
  </UModal>
</template>
