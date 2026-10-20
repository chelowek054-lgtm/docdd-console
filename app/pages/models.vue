<script setup lang="ts">
// Экран администратора «Модели»: провайдеры и ключи (T-0022). Значение ключа
// сюда не приходит — только факт, что он найден; вписанный новый уходит на сервер.
interface Setting { id: string; label?: string; type: 'openai' | 'anthropic'; baseUrl?: string; model: string; apiKeyEnv?: string; apiKey?: string; closedData?: boolean; enabled?: boolean; hasKey?: boolean }
interface Loaded { providers: Setting[]; registry: Array<{ id: string; label: string; kind: string; available: boolean; reason?: string }> }
const { data, refresh } = await useFetch<Loaded | { error: { message: string } }>('/api/llm/models', { ignoreResponseError: true });
const error = computed(() => (data.value && 'error' in data.value ? data.value.error.message : ''));
const providers = ref<Setting[]>([]);
watchEffect(() => { if (data.value && 'providers' in data.value) providers.value = data.value.providers.map((p) => ({ ...p })); });
const registry = computed(() => (data.value && 'registry' in data.value ? data.value.registry : []));
const checks = ref<Record<string, string>>({});
const saved = ref('');

function add() {
  providers.value.push({ id: `provider-${providers.value.length + 1}`, type: 'openai', baseUrl: 'http://localhost:11434/v1', model: '' });
}
async function save() {
  const result = await $fetch<{ ok?: boolean }>('/api/llm/models', { method: 'PUT', body: { providers: providers.value }, ignoreResponseError: true } as never).catch(() => null);
  saved.value = result?.ok ? 'Сохранено' : 'Не сохранено: проверьте поля';
  await refresh();
}
async function check(id: string) {
  checks.value[id] = 'проверяю…';
  const result = await $fetch<{ ok: boolean; ms?: number; failure?: { message: string } }>('/api/llm/models/check', { method: 'POST', body: { id } }).catch(() => null);
  checks.value[id] = result?.ok ? `связь есть, ${result.ms} мс` : (result?.failure?.message ?? 'нет связи');
}
</script>

<template>
  <UContainer class="space-y-4 py-6">
    <h1 class="text-xl font-semibold">Модели</h1>
    <p class="text-sm text-muted">Ключ называйте переменной окружения; значение, вписанное сюда, хранится в .data/llm.json на сервере и в браузер не возвращается.</p>
    <p v-if="error" class="text-error">{{ error }}</p>
    <template v-else>
      <ul class="text-sm">
        <li v-for="item in registry" :key="item.id">{{ item.label }} ({{ item.kind === 'agent' ? 'агент' : 'чат' }}) — {{ item.available ? 'доступен' : (item.reason ?? 'недоступен') }}</li>
      </ul>
      <div v-for="(p, at) in providers" :key="at" class="grid grid-cols-2 gap-2 border-t border-default py-3">
        <UInput v-model="p.id" placeholder="Имя (id)" />
        <USelect v-model="p.type" :items="['openai', 'anthropic']" />
        <UInput v-model="p.baseUrl" placeholder="Базовый адрес (для OpenAI-совместимых)" />
        <UInput v-model="p.model" placeholder="Модель" />
        <UInput v-model="p.apiKeyEnv" placeholder="Переменная окружения с ключом" />
        <UInput v-model="p.apiKey" type="password" :placeholder="p.hasKey ? 'ключ найден — пусто, чтобы не менять' : 'ключ (необязательно)'" />
        <UCheckbox v-model="p.closedData" label="Допущен к закрытым данным" />
        <div class="flex items-center gap-2">
          <UButton variant="ghost" color="neutral" @click="check(p.id)">Проверить связь</UButton>
          <span class="text-sm text-muted">{{ checks[p.id] }}</span>
          <UButton variant="ghost" color="error" @click="providers.splice(at, 1)">Убрать</UButton>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <UButton variant="ghost" color="neutral" @click="add">Добавить провайдера</UButton>
        <UButton @click="save">Сохранить</UButton>
        <span class="text-sm text-muted">{{ saved }}</span>
      </div>
    </template>
  </UContainer>
</template>
