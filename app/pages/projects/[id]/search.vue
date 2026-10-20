<script setup lang="ts">
import type { SearchHit } from '~~/server/lib/search';

/** Поиск по записям и знаниям проекта (T-0040). Запрос уходит на сервер с задержкой, чтобы не стрелять на каждую букву. */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const q = ref('');
const hits = ref<SearchHit[]>([]);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(q, (value) => {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const answer = await $fetch<{ hits: SearchHit[] }>(`/api/projects/${projectId.value}/search`, { query: { q: value } }).catch(() => ({ hits: [] as SearchHit[] }));
    hits.value = answer.hits;
  }, 200);
});
</script>

<template>
  <div class="space-y-3">
    <UInput v-model="q" placeholder="Поиск по записям и знаниям" class="w-full" autofocus />
    <ul class="space-y-2 text-sm">
      <li v-for="hit in hits" :key="hit.id">
        <NuxtLink v-if="hit.type !== 'note'" :to="`/projects/${projectId}/records/${hit.id}`" class="font-medium hover:underline">{{ hit.id }} · {{ hit.title }}</NuxtLink>
        <span v-else class="font-medium">{{ hit.title }}</span>
        <p class="text-xs text-muted">{{ hit.snippet }}</p>
      </li>
    </ul>
    <p v-if="q && hits.length === 0" class="text-sm text-muted">Ничего не найдено</p>
  </div>
</template>
