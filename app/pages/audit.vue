<script setup lang="ts">
// Экран администратора: журнал доступа сервера (T-0018).
interface Entry { at: string; actor: string; method: string; path: string; project: string | null; status: number }
const { t } = useT();
const actor = ref('');
const { data, refresh } = await useFetch<{ entries: Entry[] } | { error: { message: string } }>('/api/audit', {
  query: computed(() => ({ actor: actor.value || undefined })),
  ignoreResponseError: true
});
const entries = computed(() => (data.value && 'entries' in data.value ? data.value.entries : []));
const error = computed(() => (data.value && 'error' in data.value ? data.value.error.message : ''));
</script>

<template>
  <UContainer class="space-y-4 py-6">
    <h1 class="text-xl font-semibold">{{ t('audit.title') }}</h1>
    <div class="flex gap-2">
      <UInput v-model="actor" :placeholder="t('audit.person')" class="w-56" />
      <UButton variant="ghost" color="neutral" @click="refresh()">{{ t('audit.refresh') }}</UButton>
    </div>
    <p v-if="error" class="text-error">{{ error }}</p>
    <table v-else class="w-full text-sm">
      <thead><tr class="text-left text-muted"><th>{{ t('audit.when') }}</th><th>{{ t('audit.who') }}</th><th>{{ t('audit.what') }}</th><th>{{ t('audit.project') }}</th><th>{{ t('audit.code') }}</th></tr></thead>
      <tbody>
        <tr v-for="(entry, at) in entries" :key="at" class="border-t border-default">
          <td>{{ entry.at }}</td><td>{{ entry.actor }}</td><td>{{ entry.method }} {{ entry.path }}</td><td>{{ entry.project ?? '—' }}</td><td>{{ entry.status }}</td>
        </tr>
      </tbody>
    </table>
  </UContainer>
</template>
