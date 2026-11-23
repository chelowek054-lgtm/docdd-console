<script setup lang="ts">
import { blockText, shortStrategicMap } from '~~/server/lib/map-core';

/**
 * Короткая форма стратегической карты маленького проекта (R-0147): «откуда, куда, зачем» — два узла и
 * связь одним черновиком через тот же путь и линтер, что у остальных правок; подтверждает человек.
 */
const props = defineProps<{ projectId: string }>();
const emit = defineEmits<{ saved: [id: string] }>();
const { t } = useT();

const form = reactive({ from: '', to: '', why: '' });
const saving = ref(false);
const failure = ref<string[]>([]);
const savedNote = ref('');
const plan = computed(() => shortStrategicMap(form));

async function save() {
  if (!plan.value) return;
  saving.value = true;
  failure.value = [];
  try {
    const response = await $fetch<{ record?: { id: string }; error?: { message: string; blockers?: { message: string }[] } }>(
      `/api/projects/${props.projectId}/map/draft`,
      { method: 'POST', body: { answer: blockText({ kind: 'strategic' }, plan.value), title: t('maps.short.draftTitle', { to: form.to.trim() }) }, ignoreResponseError: true }
    );
    if (response.error) {
      failure.value = [response.error.message, ...(response.error.blockers ?? []).map((item) => item.message)];
      return;
    }
    const id = response.record?.id ?? '';
    savedNote.value = t('maps.editor.saved', { id });
    emit('saved', id);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <UCard data-short-form>
    <h2 class="font-medium">{{ t('maps.short.title') }}</h2>
    <p class="mb-3 text-sm text-muted">{{ t('maps.short.hint') }}</p>
    <div class="grid gap-3 sm:grid-cols-3">
      <UFormField :label="t('maps.short.from')"><UInput v-model="form.from" class="w-full" name="from" /></UFormField>
      <UFormField :label="t('maps.short.to')"><UInput v-model="form.to" class="w-full" name="to" /></UFormField>
      <UFormField :label="t('maps.short.why')"><UInput v-model="form.why" class="w-full" name="why" /></UFormField>
    </div>
    <div class="mt-3 flex flex-wrap items-center gap-2">
      <UButton :disabled="!plan" :loading="saving" icon="i-lucide-save" data-short-form-save @click="save">{{ t('maps.short.save') }}</UButton>
      <p v-if="savedNote" class="text-sm text-success">{{ savedNote }}</p>
    </div>
    <UAlert v-if="failure.length" class="mt-3" color="error" variant="subtle" :title="failure[0]">
      <template #description>
        <ul class="list-disc pl-4"><li v-for="line in failure.slice(1)" :key="line">{{ line }}</li></ul>
      </template>
    </UAlert>
  </UCard>
</template>
