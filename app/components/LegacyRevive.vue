<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * «Перенести в текущий курс» у legacy-требования (A-0001, R-0103): черновик нового
 * требования со ссылкой `derived_from`; прежняя запись не меняется.
 */
const props = defineProps<{ projectId: string; recordId: string; legacyBy?: string | null }>();
const { t } = useT();
const busy = ref(false);
const failure = ref<ApiFailure | null>(null);

async function revive() {
  busy.value = true;
  failure.value = null;
  try {
    const response = await $fetch<{ record?: { id: string } } | { error: ApiFailure }>(`/api/projects/${props.projectId}/records/${props.recordId}/revive`, { method: 'POST', ignoreResponseError: true });
    const problem = failureOf(response);
    if (problem) { failure.value = problem; return; }
    const id = (response as { record?: { id: string } }).record?.id;
    if (id) await navigateTo(`/projects/${props.projectId}/records/${id}`);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <UAlert color="neutral" variant="subtle" icon="i-lucide-archive" :title="t('lg.title')">
    <template #description>
      <p>{{ t('lg.text') }}<template v-if="legacyBy">&nbsp;{{ t('lg.by') }} <NuxtLink :to="`/projects/${projectId}/records/${legacyBy}`" class="font-mono hover:underline">{{ legacyBy }}</NuxtLink>.</template></p>
      <UButton v-can="'edit_draft'" class="mt-2" size="sm" variant="soft" icon="i-lucide-undo-2" :loading="busy" @click="revive">{{ t('lg.revive') }}</UButton>
      <p v-if="failure" class="mt-1 text-error">{{ failure.message }}</p>
    </template>
  </UAlert>
</template>
