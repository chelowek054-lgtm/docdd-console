<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * «Что уйдёт модели» (docs/adr/0021-context-pack.md): куски пакета, размер и
 * оценка цены до отправки. Снятая галочка исключает кусок из запроса.
 */
const props = defineProps<{ projectId: string; centerId: string; need?: string }>();
const emit = defineEmits<{ ready: [prompt: string]; exclude: [keys: string[]] }>();

interface Chunk { key: string; kind: string; title: string; why: string; size: number; confidential: boolean; excluded: boolean; withheld: boolean }
interface Preview { chunks: Chunk[]; cut: { key: string; title: string; size: number }[]; size: number; budget: number; tokens: number; costUsd: number; prompt: string }

const preview = ref<Preview | null>(null);
const excluded = ref<string[]>([]);
const failure = ref<ApiFailure | null>(null);
const loading = ref(false);

async function load() {
  loading.value = true;
  failure.value = null;
  try {
    const response = await $fetch<Preview | { error: ApiFailure }>(`/api/projects/${props.projectId}/context`, {
      method: 'POST',
      body: { centerId: props.centerId, need: props.need ?? 'ask', exclude: excluded.value },
      ignoreResponseError: true
    });
    if ('error' in response) { failure.value = response.error; return; }
    preview.value = response;
    emit('ready', response.prompt); emit('exclude', excluded.value);
  } catch (error) {
    failure.value = { code: 'network', message: 'Не удалось собрать пакет контекста', detail: String(error) };
  } finally {
    loading.value = false;
  }
}

function toggle(key: string) {
  excluded.value = excluded.value.includes(key) ? excluded.value.filter((item) => item !== key) : [...excluded.value, key];
  void load();
}

watch(() => [props.projectId, props.centerId, props.need], load, { immediate: true });
</script>

<template>
  <section class="context-preview">
    <h3>Что уйдёт модели</h3>
    <p v-if="failure" role="alert">{{ failure.message }}</p>
    <p v-else-if="loading && !preview">Собираю пакет…</p>
    <template v-else-if="preview">
      <p>
        {{ preview.size }} зн. из {{ preview.budget }}, около {{ preview.tokens }} токенов,
        ориентировочно ${{ preview.costUsd }}
      </p>
      <ul>
        <li v-for="chunk in preview.chunks" :key="chunk.key">
          <label>
            <input type="checkbox" :checked="!chunk.excluded && !chunk.withheld" :disabled="chunk.withheld" @change="toggle(chunk.key)">
            {{ chunk.title }} ({{ chunk.size }} зн.) — {{ chunk.why }}
            <em v-if="chunk.withheld">закрыт: провайдер не допущен к закрытым данным</em>
          </label>
        </li>
      </ul>
      <details v-if="preview.cut.length">
        <summary>Не влезло в бюджет: {{ preview.cut.length }}</summary>
        <ul><li v-for="item in preview.cut" :key="item.key">{{ item.title }} ({{ item.size }} зн.)</li></ul>
      </details>
    </template>
  </section>
</template>
