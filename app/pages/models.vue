<script setup lang="ts">
// Экран администратора «Модели»: провайдеры и ключи (T-0022). Значение ключа
// сюда не приходит — только факт, что он найден; вписанный новый уходит на сервер.
interface Setting { clearKey?: boolean; id: string; label?: string; type: 'openai' | 'anthropic'; baseUrl?: string; model: string; apiKeyEnv?: string; apiKey?: string; closedData?: boolean; enabled?: boolean; hasKey?: boolean }
interface Loaded { agents?: string[]; verified?: string[]; chatHidden?: string[]; routes?: Record<string, { providerId: string; model?: string }>; providers: Setting[]; registry: Array<{ id: string; label: string; kind: string; available: boolean; reason?: string }> }
const { t, locale } = useT();
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
const providerIds = computed(() => ['claude-code', ...agents.value, ...providers.value.map((p) => p.id)]);
function addRoute() { routes.value.push({ kind: 'ask', providerId: 'claude-code', model: '' }); }
const routesBody = () => Object.fromEntries(routes.value.filter((r) => r.kind).map((r) => [r.kind, { providerId: r.providerId, ...(r.model ? { model: r.model } : {}) }]));
// Расходы за месяц (оценка по символам) и очередь запросов выбранного проекта (T-0024, T-0026).
interface TaskRow { taskId: string; kind: string; requests: number; input: number; output: number; cacheRead: number; cacheWrite: number; estimated: number }
interface Total { requests: number; ms: number; chars: number; costUsd: number; tokens?: number; estimated?: number }
/** «≈» — только когда в сумме есть оценка по символам (R-0093); по токенам провайдера — точно. */
const money = (tot: Total) => `${tot.estimated ? '≈ ' : ''}$${tot.costUsd.toFixed(3)}${tot.tokens ? t('t83.m7.tok', { n: tot.tokens.toLocaleString(locale.value === 'ru' ? 'ru-RU' : 'en-US') }) : ''}`;
const { data: usage } = await useFetch<{ month: string; total: Total; byUser: Record<string, Total>; byModel: Record<string, Total>; byTask?: TaskRow[] }>('/api/llm/usage', { ignoreResponseError: true });
const { data: projectList } = await useFetch<{ projects?: Array<{ id: string; name?: string }> } | Array<{ id: string; name?: string }>>('/api/projects', { ignoreResponseError: true });
const projectOptions = computed(() => { const v = projectList.value; return Array.isArray(v) ? v : (v?.projects ?? []); });
const queueProject = ref('');
watchEffect(() => { if (!queueProject.value && projectOptions.value[0]) queueProject.value = projectOptions.value[0].id; });
interface Job { id: string; user: string; kind: string; state: string; note?: string; answer?: string; ms?: number }
const jobs = ref<Job[]>([]);
async function loadQueue() { if (queueProject.value) jobs.value = (await $fetch<{ jobs: Job[] }>(`/api/projects/${encodeURIComponent(queueProject.value)}/llm/queue`).catch(() => ({ jobs: [] }))).jobs; }
async function cancelJob(id: string) { await $fetch(`/api/projects/${encodeURIComponent(queueProject.value)}/llm/queue/${id}`, { method: 'DELETE' }).catch(() => null); await loadQueue(); }
onMounted(() => { void loadQueue(); const timer = setInterval(() => void loadQueue(), 3000); onBeforeUnmount(() => clearInterval(timer)); });

const cliProviders = computed(() => registry.value.filter((item) => item.kind === 'agent'));
const connection = ref<'cli' | 'api'>(routes.value.find((route) => route.kind === 'ask')?.providerId.match(/^(claude-code|codex-cli|gemini-cli)$/) ? 'cli' : 'api');
const saving = ref(false);
const probe = ref<{ id: string; ok: boolean }>();
const savedChat = computed(() => data.value && 'providers' in data.value ? (data.value.routes?.ask?.providerId ?? 'claude-code') : 'claude-code');
const cliOptions = computed(() => [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex-cli', label: 'Codex CLI' },
  ...cliProviders.value.filter((item) => !['claude-code', 'codex-cli'].includes(item.id))
].map((item) => ({ ...item, status: cliProviders.value.find((entry) => entry.id === item.id) })));
const chatLabel = computed(() => cliOptions.value.find((item) => item.id === savedChat.value)?.label
  ?? (data.value && 'providers' in data.value ? data.value.providers.find((item) => item.id === savedChat.value)?.label : undefined)
  ?? savedChat.value);

async function save(verifyProviderId?: string) {
  if (saving.value) return false;
  saving.value = true;
  saved.value = '';
  probe.value = undefined;
  const outgoingRoutes = routesBody();
  try {
    const result = await $fetch<{ ok?: boolean; error?: { message: string }; verification?: { ok: boolean } }>('/api/llm/models', {
      method: 'PUT',
      body: { providers: providers.value, routes: outgoingRoutes, agents: agents.value, verifyProviderId, chatHidden: hidden.value },
      ignoreResponseError: true
    } as never).catch(() => null);
    if (result?.verification && verifyProviderId) probe.value = { id: verifyProviderId, ok: result.verification.ok };
    saved.value = probe.value ? '' : (result?.ok ? t('mod.saved') : (result?.error?.message ?? t('mod.notSaved')));
    if (result?.ok) await refresh();
    return result?.ok === true;
  } finally {
    saving.value = false;
  }
}
async function check(id: string) {
  checks.value[id] = t('mod.checking');
  const result = await $fetch<{ ok: boolean; ms?: number; failure?: { message: string } }>('/api/llm/models/check', { method: 'POST', body: { id } }).catch(() => null);
  checks.value[id] = result?.ok ? t('mod.linkOk', { ms: result.ms ?? 0 }) : (result?.failure?.message ?? t('mod.noLink'));
}

const presets = {
  local: { id: 'provider', baseUrl: 'http://localhost:11434/v1', model: '' },
  openrouter: { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
  deepseek: { id: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-flash' }
};
const agents = ref<string[]>([]);
watchEffect(() => {
  if (data.value && 'providers' in data.value) agents.value = [...(data.value.agents ?? [])];
});
function add(preset: keyof typeof presets = 'local') {
  const config = presets[preset];
  let suffix = preset === 'local' ? 1 : 0;
  const id = () => suffix ? `${config.id}-${suffix}` : config.id;
  while (providers.value.some((provider) => provider.id === id())) suffix++;
  providers.value.push({ ...config, id: id(), type: 'openai' });
}
async function useInChat(providerId: string) {
  if (saving.value) return;
  const previousRoutes = routes.value.map((route) => ({ ...route }));
  const previousAgents = [...agents.value];
  const previousHidden = [...hidden.value];
  hidden.value = hidden.value.filter((id) => id !== providerId);
  if (providerId === 'codex-cli' && !agents.value.includes(providerId)) agents.value.push(providerId);
  const route = routes.value.find((item) => item.kind === 'ask');
  if (route) Object.assign(route, { providerId, model: '' });
  else routes.value.push({ kind: 'ask', providerId, model: '' });
  if (await save(providerId)) return;
  routes.value = previousRoutes;
  agents.value = previousAgents;
  hidden.value = previousHidden;
}
const props = defineProps<{ embedded?: boolean }>();
const verified = computed(() => data.value && 'providers' in data.value ? (data.value.verified ?? []) : []);
const hidden = ref<string[]>([]);
watchEffect(() => { if (data.value && 'providers' in data.value) hidden.value = [...(data.value.chatHidden ?? [])]; });

async function verifyModel(id: string, visible?: boolean) {
  if (saving.value) return;
  const previousHidden = [...hidden.value];
  const previousAgents = [...agents.value];
  if (visible === true) hidden.value = hidden.value.filter((item) => item !== id);
  if (visible === false) hidden.value = [...new Set([...hidden.value, id])];
  if (visible !== false && id === 'codex-cli' && !agents.value.includes(id)) agents.value.push(id);
  if (await save(visible === false ? undefined : id)) return;
  hidden.value = previousHidden;
  agents.value = previousAgents;
}

const inChat = (id: string) => verified.value.includes(id) && !hidden.value.includes(id);
</script>

<template>
  <UContainer class="space-y-4" :class="props.embedded ? 'px-0' : 'py-6'">
    <h1 v-if="!props.embedded" class="text-xl font-semibold">{{ t('mod.title') }}</h1>
    <p v-if="error" class="text-error">{{ error }}</p>
    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <UTabs v-model="connection" :content="false" :items="[{ label: t('mod.apiTab'), value: 'api' }, { label: t('mod.cliTab'), value: 'cli' }]" />
        <UBadge v-if="inChat(savedChat)" variant="soft" color="neutral">{{ t('mod.currentChat', { name: chatLabel }) }}</UBadge>
      </div>
      <p v-if="saved" role="status" class="text-sm">{{ saved }}</p>
      <section v-if="connection === 'cli'" class="max-w-3xl space-y-3">
        <p class="text-sm text-muted">{{ t('mod.cliHint') }}</p>
        <div v-for="item in cliOptions" :key="item.id" class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-default p-4">
          <div>
            <h2 class="font-medium">{{ item.label }}</h2>
            <p class="text-sm text-muted">{{ item.status?.available ? t('mod.available') : (item.status ? t('mod.cliUnavailable') : t('mod.cliNotEnabled')) }}</p>
            <p v-if="probe?.id === item.id" role="status" class="flex items-center gap-1 text-sm" :class="probe.ok ? 'text-success' : 'text-error'">
              <UIcon :name="probe.ok ? 'i-lucide-check' : 'i-lucide-x'" />
              {{ t(probe.ok ? 'mod.probeOk' : 'mod.pickCli') }}
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2">
            <UCheckbox :model-value="inChat(item.id)" :disabled="saving || item.status?.available === false" :label="t('mod.showInChat')"
              @update:model-value="verifyModel(item.id, $event === true)" />
            <UButton size="sm" variant="ghost" color="neutral" :disabled="saving || item.status?.available === false" @click="verifyModel(item.id)">{{ t('mod.retryProbe') }}</UButton>
          </div>
        </div>
      </section>
      <section v-else class="max-w-3xl space-y-3">
        <p class="text-sm text-muted">{{ t('mod.apiHint') }}</p>
        <div class="flex flex-wrap gap-2">
          <UButton variant="soft" @click="add('deepseek')">{{ t('mod.addDeepSeek') }}</UButton>
          <UButton variant="soft" @click="add('openrouter')">{{ t('mod.addOpenRouter') }}</UButton>
          <UButton variant="ghost" color="neutral" @click="add()">{{ t('mod.addProvider') }}</UButton>
        </div>
        <form v-for="(p, at) in providers" :key="at" class="space-y-4 rounded-lg border border-default p-4" @input="probe = undefined" @submit.prevent="useInChat(p.id)">
          <h2 class="font-medium">{{ p.label || p.id }}</h2>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t('mod.apiKey')" name="apiKey">
              <UInput v-model="p.apiKey" type="password" autocomplete="off" class="w-full" :placeholder="p.hasKey ? t('mod.keyFound') : t('mod.pasteKey')" @update:model-value="p.clearKey = false" />
            </UFormField>
            <UFormField :label="t('mod.modelId')" name="model">
              <UInput v-model.trim="p.model" required class="w-full" :color="probe?.id === p.id && !probe.ok ? 'error' : undefined" :aria-invalid="probe?.id === p.id && !probe.ok ? true : undefined" :placeholder="p.label === 'OpenRouter' ? 'openai/gpt-5' : p.label === 'DeepSeek' ? presets.deepseek.model : ''" />
            </UFormField>
          </div>
          <details :open="p.id.startsWith('provider-') || undefined">
            <summary class="cursor-pointer text-sm text-muted">{{ t('mod.advanced') }}</summary>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <UFormField :label="t('mod.id')"><UInput v-model="p.id" class="w-full" /></UFormField>
              <UFormField :label="t('mod.protocol')"><USelect v-model="p.type" :items="['openai', 'anthropic']" class="w-full" /></UFormField>
              <UFormField :label="t('mod.baseUrl')"><UInput v-model="p.baseUrl" class="w-full" /></UFormField>
              <UFormField :label="t('mod.keyEnv')"><UInput v-model="p.apiKeyEnv" class="w-full" /></UFormField>
              <UCheckbox v-model="p.closedData" :label="t('mod.closed')" />
              <UButton v-if="p.hasKey" size="xs" variant="ghost" color="error" @click="p.clearKey = true; p.apiKey = ''; p.hasKey = false">{{ t('t83.models.1') }}</UButton>
              <span v-if="p.clearKey" class="text-xs text-muted">{{ t('t83.models.2') }}</span>
              <UButton variant="ghost" color="neutral" @click="check(p.id)">{{ t('mod.check') }}</UButton>
              <span class="text-sm text-muted">{{ checks[p.id] }}</span>
            </div>
          </details>
          <div class="flex flex-wrap gap-2">
            <UCheckbox :model-value="inChat(p.id)" :disabled="saving || !p.model.trim()" :label="t('mod.showInChat')"
              @update:model-value="verifyModel(p.id, $event === true)" />
            <UButton size="sm" variant="ghost" color="neutral" :disabled="saving || !p.model.trim()" @click="verifyModel(p.id)">{{ t('mod.retryProbe') }}</UButton>
            <UButton type="submit" :loading="saving" :disabled="!p.model.trim()">{{ t('mod.saveAndUse') }}</UButton>
            <UButton variant="ghost" color="error" @click="providers.splice(at, 1); routes = routes.filter((route) => route.providerId !== p.id)">{{ t('mod.remove') }}</UButton>
          </div>
          <p v-if="probe?.id === p.id" role="status" class="flex items-center gap-1 text-sm" :class="probe.ok ? 'text-success' : 'text-error'">
            <UIcon :name="probe.ok ? 'i-lucide-check' : 'i-lucide-x'" />
            {{ t(probe.ok ? 'mod.probeOk' : 'mod.pickModel') }}
          </p>
        </form>
      </section>
      <details class="max-w-3xl space-y-3 rounded-lg border border-default p-4">
        <summary class="cursor-pointer font-medium">{{ t('mod.routes') }}</summary>
        <div v-for="(r, at) in routes" :key="'r' + at" class="flex flex-wrap items-center gap-2">
          <UInput v-model="r.kind" :placeholder="t('mod.kind')" />
          <USelect v-model="r.providerId" :items="providerIds" />
          <UInput v-model="r.model" :placeholder="t('mod.modelOptional')" />
          <UButton variant="ghost" color="error" @click="routes.splice(at, 1)">{{ t('mod.remove') }}</UButton>
        </div>
        <UButton variant="ghost" color="neutral" @click="addRoute">{{ t('mod.addRoute') }}</UButton>
      </details>
      <UButton variant="outline" :loading="saving" @click="save()">{{ t('mod.save') }}</UButton>
      <template v-if="!props.embedded">
      <h2 class="pt-3 font-medium">{{ t('mod.spend', { month: usage?.month ?? '' }) }}</h2>
      <p v-if="usage" class="text-sm">{{ t('mod.requests') }}: {{ usage.total.requests }}, {{ money(usage.total) }}</p>
      <ul v-if="usage" class="text-sm text-muted">
        <li v-for="(tot, who) in usage.byUser" :key="'u' + who">{{ who }}: {{ tot.requests }} {{ t('mod.req') }}, {{ money(tot) }}</li>
        <li v-for="(tot, model) in usage.byModel" :key="'m' + model">{{ model }}: {{ tot.requests }} {{ t('mod.req') }}, {{ money(tot) }}</li>
      </ul>
      <template v-if="usage?.byTask?.length">
        <h2 class="pt-3 font-medium">{{ t('mod.byTask') }}</h2>
        <ul class="text-sm text-muted">
          <li v-for="row in usage.byTask" :key="row.taskId + row.kind">{{ row.estimated ? '≈ ' : '' }}{{ t('mod.taskRow', { task: row.taskId, kind: row.kind, n: row.requests, input: row.input, output: row.output, read: row.cacheRead, write: row.cacheWrite }) }}</li>
        </ul>
      </template>
      <h2 class="pt-3 font-medium">{{ t('mod.queue') }}</h2>
      <USelect v-model="queueProject" :items="projectOptions.map((p) => ({ label: p.name ?? p.id, value: p.id }))" @update:model-value="loadQueue" />
      <ul class="text-sm">
        <li v-for="job in jobs" :key="job.id">{{ job.kind }} · {{ job.user }} · {{ job.state }}{{ job.note ? ' — ' + job.note : '' }}
          <UButton v-if="job.state === 'queued' || job.state === 'running'" size="xs" variant="ghost" color="error" @click="cancelJob(job.id)">{{ t('mod.cancel') }}</UButton>
          <details v-if="job.answer"><summary>{{ t('t83.m4.md.answer') }}{{ job.ms ? t('t83.m4.md.ms', { ms: job.ms }) : '' }}</summary><pre class="whitespace-pre-wrap">{{ job.answer }}</pre></details>
        </li>
      </ul>
      </template>
    </template>
  </UContainer>
</template>
