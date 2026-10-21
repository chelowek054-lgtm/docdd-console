<script setup lang="ts">
// Экран администратора «Модели»: провайдеры и ключи (T-0022). Значение ключа
// сюда не приходит — только факт, что он найден; вписанный новый уходит на сервер.
interface Setting { clearKey?: boolean; id: string; label?: string; type: 'openai' | 'anthropic'; baseUrl?: string; model: string; apiKeyEnv?: string; apiKey?: string; closedData?: boolean; enabled?: boolean; hasKey?: boolean }
interface Loaded { routes?: Record<string, { providerId: string; model?: string }>; providers: Setting[]; registry: Array<{ id: string; label: string; kind: string; available: boolean; reason?: string }> }
const { data, refresh } = await useFetch<Loaded | { error: { message: string } }>('/api/llm/models', { ignoreResponseError: true });
const error = computed(() => (data.value && 'error' in data.value ? data.value.error.message : ''));
const providers = ref<Setting[]>([]);
watchEffect(() => { if (data.value && 'providers' in data.value) providers.value = data.value.providers.map((p) => ({ ...p })); });
const registry = computed(() => (data.value && 'registry' in data.value ? data.value.registry : []));
const checks = ref<Record<string, string>>({});
const saved = ref('');
// Таблица «вид запроса → модель»: смена модели не требует правки кода (T-0023).
const routes = ref<Array<{ kind: string; providerId: string; model: string }>>([]);
watchEffect(() => { if (data.value && 'providers' in data.value) routes.value = Object.entries(data.value.routes ?? {}).map(([kind, r]) => ({ kind, providerId: r.providerId, model: r.model ?? '' })); });
const providerIds = computed(() => ['claude-code', ...providers.value.map((p) => p.id)]);
function addRoute() { routes.value.push({ kind: 'ask', providerId: 'claude-code', model: '' }); }
const routesBody = () => Object.fromEntries(routes.value.filter((r) => r.kind).map((r) => [r.kind, { providerId: r.providerId, ...(r.model ? { model: r.model } : {}) }]));
// Расходы за месяц (оценка по символам) и очередь запросов выбранного проекта (T-0024, T-0026).
interface Total { requests: number; ms: number; chars: number; costUsd: number }
const { data: usage } = await useFetch<{ month: string; total: Total; byUser: Record<string, Total>; byModel: Record<string, Total> }>('/api/llm/usage', { ignoreResponseError: true });
const { data: projectList } = await useFetch<{ projects?: Array<{ id: string; name?: string }> } | Array<{ id: string; name?: string }>>('/api/projects', { ignoreResponseError: true });
const projectOptions = computed(() => { const v = projectList.value; return Array.isArray(v) ? v : (v?.projects ?? []); });
const queueProject = ref('');
watchEffect(() => { if (!queueProject.value && projectOptions.value[0]) queueProject.value = projectOptions.value[0].id; });
interface Job { id: string; user: string; kind: string; state: string; note?: string; answer?: string; ms?: number }
const jobs = ref<Job[]>([]);
async function loadQueue() { if (queueProject.value) jobs.value = (await $fetch<{ jobs: Job[] }>(`/api/projects/${encodeURIComponent(queueProject.value)}/llm/queue`).catch(() => ({ jobs: [] }))).jobs; }
async function cancelJob(id: string) { await $fetch(`/api/projects/${encodeURIComponent(queueProject.value)}/llm/queue/${id}`, { method: 'DELETE' }).catch(() => null); await loadQueue(); }
onMounted(() => { void loadQueue(); const timer = setInterval(() => void loadQueue(), 3000); onBeforeUnmount(() => clearInterval(timer)); });

function add() {
  providers.value.push({ id: `provider-${providers.value.length + 1}`, type: 'openai', baseUrl: 'http://localhost:11434/v1', model: '' });
}
async function save() {
  const result = await $fetch<{ ok?: boolean }>('/api/llm/models', { method: 'PUT', body: { providers: providers.value, routes: routesBody() }, ignoreResponseError: true } as never).catch(() => null);
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
        <UButton v-if="p.hasKey" size="xs" variant="ghost" color="error" @click="p.clearKey = true; p.apiKey = ''; p.hasKey = false">Стереть ключ</UButton>
        <span v-if="p.clearKey" class="text-xs text-muted">ключ будет стёрт после «Сохранить»</span>
        <UCheckbox v-model="p.closedData" label="Допущен к закрытым данным" />
        <div class="flex items-center gap-2">
          <UButton variant="ghost" color="neutral" @click="check(p.id)">Проверить связь</UButton>
          <span class="text-sm text-muted">{{ checks[p.id] }}</span>
          <UButton variant="ghost" color="error" @click="providers.splice(at, 1)">Убрать</UButton>
        </div>
      </div>
      <h2 class="pt-3 font-medium">Вид запроса → модель</h2>
      <div v-for="(r, at) in routes" :key="'r' + at" class="flex items-center gap-2">
        <UInput v-model="r.kind" placeholder="Вид (ask, task, ...)" />
        <USelect v-model="r.providerId" :items="providerIds" />
        <UInput v-model="r.model" placeholder="Модель (необязательно)" />
        <UButton variant="ghost" color="error" @click="routes.splice(at, 1)">Убрать</UButton>
      </div>
      <UButton variant="ghost" color="neutral" @click="addRoute">Добавить вид запроса</UButton>
      <div class="flex items-center gap-2">
        <UButton variant="ghost" color="neutral" @click="add">Добавить провайдера</UButton>
        <UButton @click="save">Сохранить</UButton>
        <span class="text-sm text-muted">{{ saved }}</span>
      </div>
      <h2 class="pt-3 font-medium">Расход за {{ usage?.month }} (оценка по символам; цены — поле prices в llm.json)</h2>
      <p v-if="usage" class="text-sm">Запросов: {{ usage.total.requests }}, ≈ ${{ usage.total.costUsd.toFixed(3) }}</p>
      <ul v-if="usage" class="text-sm text-muted">
        <li v-for="(t, who) in usage.byUser" :key="'u' + who">{{ who }}: {{ t.requests }} зап., ≈ ${{ t.costUsd.toFixed(3) }}</li>
        <li v-for="(t, model) in usage.byModel" :key="'m' + model">{{ model }}: {{ t.requests }} зап., ≈ ${{ t.costUsd.toFixed(3) }}</li>
      </ul>
      <h2 class="pt-3 font-medium">Очередь запросов</h2>
      <USelect v-model="queueProject" :items="projectOptions.map((p) => ({ label: p.name ?? p.id, value: p.id }))" @update:model-value="loadQueue" />
      <ul class="text-sm">
        <li v-for="job in jobs" :key="job.id">{{ job.kind }} · {{ job.user }} · {{ job.state }}{{ job.note ? ' — ' + job.note : '' }}
          <UButton v-if="job.state === 'queued' || job.state === 'running'" size="xs" variant="ghost" color="error" @click="cancelJob(job.id)">Отменить</UButton>
          <details v-if="job.answer"><summary>Ответ{{ job.ms ? `, ${job.ms} мс` : '' }}</summary><pre class="whitespace-pre-wrap">{{ job.answer }}</pre></details>
        </li>
      </ul>
    </template>
  </UContainer>
</template>
