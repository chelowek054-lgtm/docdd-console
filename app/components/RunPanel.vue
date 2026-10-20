<script setup lang="ts">
// Вкладка «Прогон» экрана «Сверка» (R-0062): набор проверок, сборка, итог по каждой и общий.
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { index, records, refresh } = useProjectIndex(projectId);

type State = 'passed' | 'failed' | 'skipped';
const checks = computed(() => records.value.filter((record) => record.type === 'verification' && record.status === 'approved'));
const build = ref('');
const chosen = ref<Record<string, State>>({});
const message = ref('');
const items = [
  { label: 'не в прогоне', value: 'none' },
  { label: 'прошла', value: 'passed' },
  { label: 'провалена', value: 'failed' },
  { label: 'пропущена', value: 'skipped' }
];
const picked = computed(() => Object.entries(chosen.value));
const failed = computed(() => picked.value.filter(([, state]) => state === 'failed').length);

function choose(id: string, value: string) {
  const next = { ...chosen.value };
  if (value === 'none') delete next[id]; else next[id] = value as State;
  chosen.value = next;
}

async function submit() {
  const response = await $fetch<{ error?: { message: string }; report?: string }>(`/api/projects/${projectId.value}/runs`, {
    method: 'POST',
    body: { build: build.value, results: chosen.value },
    ignoreResponseError: true
  });
  message.value = response.error ? response.error.message : `Отчёт записан: ${response.report}`;
  if (!response.error) { chosen.value = {}; await refresh(); }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center gap-3">
      <h2 class="text-lg font-semibold">Прогон на сборку</h2>
      <UInput v-model="build" placeholder="Версия сборки или релиза" class="w-64" />
      <UButton :disabled="!build.trim() || picked.length === 0" @click="submit">Записать прогон</UButton>
      <p class="text-sm text-muted">В прогоне {{ picked.length }}, провалено {{ failed }}</p>
    </div>
    <p v-if="message" class="text-sm">{{ message }}</p>
    <ul class="space-y-1">
      <li v-for="check in checks" :key="check.id" class="flex items-center gap-3">
        <span class="font-mono text-xs">{{ check.id }}</span>
        <span class="flex-1 text-sm">{{ check.title }}</span>
        <span class="text-xs text-muted">{{ index?.verificationResults?.[check.id]?.state ?? 'не запускалась' }}</span>
        <USelect :model-value="chosen[check.id] ?? 'none'" :items="items" class="w-40" @update:model-value="(v) => choose(check.id, String(v))" />
      </li>
    </ul>
  </div>
</template>
