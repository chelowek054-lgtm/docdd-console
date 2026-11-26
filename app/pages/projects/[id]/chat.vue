<script setup lang="ts">
import type { SearchHit } from '~~/server/lib/search';
import { sortTasks } from '~~/server/lib/work-order';
import { chatDraft, type ChatDraft, type ChatMode } from '~/utils/chat-draft';
import ModelSettings from '~/pages/models.vue';

definePageMeta({ fitViewport: true });

type Profile = 'developer' | 'architect' | 'general';
type Source = { id: string; title: string };
type Stage = 'searching' | 'reading' | 'waiting' | 'answered' | 'failedStage' | 'cancelled';
interface Turn { question: string; profile: Profile; center?: string; answer?: string; sources: Source[]; stage?: Stage; matches?: number; provider?: string; phase?: string; mode?: ChatMode; map?: string; mapToken?: string; draft?: ChatDraft }
interface Reply { answer: string; provider?: string }
interface Context { prompt: string; chunks: { key: string; title: string; withheld: boolean; excluded: boolean }[] }

const templates: Record<Profile, { types: string[]; guidance: string }> = {
  developer: { types: ['task', 'verification'], guidance: 'Сверь ожидаемый результат задачи, связанные модули и проверки. Укажи, что ещё нужно проверить.' },
  architect: { types: ['requirement', 'decision', 'design', 'map', 'contract'], guidance: 'Сверь требования, решения и карты. Покажи допущения, границы и последствия.' },
  general: { types: [], guidance: 'Ответь на вопрос по данным проекта.' }
};
const { t } = useT();
const route = useRoute();
const projectId = computed(() => String(route.params.id ?? ''));
const base = computed(() => `/api/projects/${encodeURIComponent(projectId.value)}`);
const { records, index: projectIndex, refresh: refreshProject } = useProjectIndex(projectId);
const { data: priority, refresh: refreshPriority } = useLazyFetch<{ state: 'current' | 'stale' | 'missing' }>(() => `${base.value}/priority`, { server: false });
const titles = computed(() => Object.fromEntries(records.value.map((record) => [record.id, record.title])));
const { me } = useMe(projectId);
const chats = useProjectChats<Turn>(projectId);
const { active, summaries, error: chatError, loading } = chats;
interface ChatModel { id: string; label: string; kind: 'chat' | 'agent'; model?: string }
const { data: modelCatalog, pending: modelsLoading, error: modelsError, refresh: refreshModels } = useLazyFetch<{ models: ChatModel[]; defaultId?: string }>(
  () => `${base.value}/chat/models`, { server: false }
);
const modelOpen = ref(false);
const modelSettingsOpen = ref(false);
const refreshingModels = ref(false);
const modelNotice = ref('');
const checks = ref<Record<string, 'checking' | 'ok' | 'failed'>>({});
const modelChoices = computed(() => modelCatalog.value?.models ?? []);
const selectedModel = computed(() => modelChoices.value.find((model) => model.id === (active.value?.providerId ?? modelCatalog.value?.defaultId)));
const modelLabel = (model: ChatModel) => [model.label, model.model].filter(Boolean).join(' · ');

function openModels() {
  modelOpen.value = true;
  void refreshModels();
}

async function checkModel(id: string) {
  checks.value[id] = 'checking';
  const result = await $fetch<{ ok: boolean }>(`${base.value}/chat/models`, { method: 'POST', body: { id } }).catch(() => null);
  checks.value[id] = result?.ok ? 'ok' : 'failed';
  return result?.ok === true;
}

async function chooseModel(id: string) {
  const chat = active.value;
  if (!chat || refreshingModels.value || Object.values(checks.value).includes('checking')) return;
  if (!await checkModel(id) || active.value?.id !== chat.id) return;
  chat.providerId = id;
  void chats.persist(chat);
}

async function updateModels() {
  if (refreshingModels.value || Object.values(checks.value).includes('checking')) return;
  refreshingModels.value = true;
  modelNotice.value = '';
  try {
    await refreshModels({ dedupe: 'cancel' });
    if (modelsError.value) throw modelsError.value;
    checks.value = {};
    for (const model of modelChoices.value) await checkModel(model.id);
    modelNotice.value = t('chat.modelsRefreshed', { count: modelChoices.value.length });
  } catch {
    modelNotice.value = t('chat.modelsRefreshFailed');
  } finally {
    refreshingModels.value = false;
  }
}
const role = useCookie<string>('docdd-role');
const effectiveRole = computed(() => role.value || (me.value.roles?.length === 1 ? me.value.roles[0] : ''));
const picked = ref<Profile>();
watch(effectiveRole, () => { picked.value = undefined; });
const profile = computed<Profile>({
  get: () => picked.value ?? (mode.value === 'map' ? 'architect' : mode.value === 'task' ? 'developer'
    : effectiveRole.value === 'developer' || effectiveRole.value === 'architect' ? effectiveRole.value : 'general'),
  set: (value) => { picked.value = value; }
});
const selected = computed(() => active.value?.record ?? '');
const phase = computed(() => active.value?.phase ?? '');
const mode = ref<ChatMode>('ask');
const access = ref<'read' | 'edits'>('read');
const workOpen = ref(false);
const map = ref('functional');
const maps = ['functional', 'domain', 'sysdesign'];
const searchStopWords = new Set('как что кто где какой какая какие мне нужно хочу может можно сделать расскажи покажи найти my the for what how can show please this that'.split(' '));
const input = ref('');
const preparing = ref(false);
let preparation: AbortController | undefined;
const feed = ref<HTMLElement>();
const turnPreview = (turn: Turn) => [turn.question, turn.answer].filter(Boolean).join(' — ').replace(/\s+/g, ' ');

function jumpToTurn(index: number) {
  const pane = feed.value;
  const turn = pane?.querySelector<HTMLElement>(`[data-chat-turn="${index}"]`);
  if (!pane || !turn) return;
  pane.scrollTo({ top: pane.scrollTop + turn.getBoundingClientRect().top - pane.getBoundingClientRect().top });
}
const turns = computed(() => active.value?.turns ?? []);
const focused = computed(() => records.value.find((record) => record.id === selected.value));
const focusedPhase = computed(() => records.value.find((record) => record.id === phase.value));
const firstReady = computed(() => {
  const covered = new Set(focusedPhase.value?.links.covers ?? []);
  return sortTasks(records.value.filter((record) => record.type === 'task' && record.status === 'ready'
    && (!phase.value || record.phase === phase.value || covered.has(record.id))), records.value, 'importance')[0];
});
const workTask = computed(() => focused.value?.type === 'task' ? focused.value : firstReady.value);
const contextOpen = ref(false);
const sidebarTab = ref<'context' | 'git' | 'agents'>('context');
const accessOpen = ref(false);
const insertMention = ref(false);
const contextQuery = ref('');
const contextFilter = ref('all');
const contextPageSize = 40;
const contextLimit = ref(contextPageSize);
const contextList = ref<HTMLElement>();
watch([contextQuery, contextFilter], () => {
  contextLimit.value = contextPageSize;
  if (contextList.value) contextList.value.scrollTop = 0;
});
const accessOptions = [
  { value: 'read', name: 'chat.accessRead', detail: 'chat.accessReadHint', icon: 'i-lucide-eye' },
  { value: 'edits', name: 'chat.accessEdits', detail: 'chat.accessEditsHint', icon: 'i-lucide-pencil' },
  { value: 'full', name: 'chat.accessFull', detail: 'chat.accessFullHint', icon: 'i-lucide-shield-alert' }
] as const;
const accessLabel = computed(() => accessOptions.find((item) => item.value === access.value)?.name ?? 'chat.accessRead');

function showContext(mention = false) {
  sidebarTab.value = 'context';
  insertMention.value = mention;
  contextQuery.value = '';
  contextFilter.value = 'all';
  contextOpen.value = true;
}

function chooseContext(type: 'record' | 'phase', id: string) {
  if (!insertMention.value) return focus(type, id);
  const message = input.value.replace(/(^|\s)@$/, '$1').trimEnd();
  input.value = (message ? message + ' ' : '') + '@' + id + ' ';
  contextOpen.value = false;
}

watch(input, (message) => {
  if (!contextOpen.value && /(?:^|\s)@$/.test(message)) showContext(true);
});
const filters = ['all', 'task', 'phase', 'map', 'document'];
const contextResults = computed(() => {
  const query = contextQuery.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return records.value.filter((item) => {
    const filter = contextFilter.value;
    if (filter === 'document' ? ['task', 'phase', 'map'].includes(item.type) : filter !== 'all' && item.type !== filter) return false;
    const haystack = (item.id + ' ' + item.title).toLowerCase();
    return query.every((part) => haystack.includes(part));
  });
});
function showMoreContext() {
  contextLimit.value = Math.min(contextLimit.value + contextPageSize, contextResults.value.length);
}

function onContextScroll(event: Event) {
  const list = event.currentTarget as HTMLElement;
  if (contextLimit.value < contextResults.value.length && list.scrollHeight - list.scrollTop - list.clientHeight < 80) showMoreContext();
}
const query = ref('');
const archived = ref(false);
const visibleChats = computed(() => summaries.value.filter((item) =>
  item.archived === archived.value && (item.title + ' ' + item.record + ' ' + item.phase).toLowerCase().includes(query.value.trim().toLowerCase())));
const naming = ref(false);
const title = ref('');
const creating = ref(false);

watch(() => active.value?.id, () => { mode.value = 'ask'; access.value = 'read'; workOpen.value = false; input.value = ''; naming.value = false; });

async function newChat() {
  if (creating.value) return;
  creating.value = true;
  try {
    const chat = await chats.create();
    if (chat) { archived.value = false; await chats.open(chat.id); }
  } finally {
    creating.value = false;
  }
}

async function focus(type: 'record' | 'phase', id: string) {
  const chat = active.value;
  if (!chat) return;
  chat[type] = id;
  contextOpen.value = false;
  await chats.persist(chat);
}

async function rename() {
  if (!active.value || !title.value.trim()) return;
  active.value.title = title.value.trim();
  naming.value = false;
  await chats.persist(active.value);
}

async function archive() {
  const chat = active.value;
  if (!chat) return;
  chat.archived = !chat.archived;
  if (await chats.persist(chat)) archived.value = chat.archived;
  else chat.archived = !chat.archived;
}

const { running, elapsed, outcome, log, stream, cancel } = useModelRequest(() => `${projectId.value}:chat:${active.value?.id ?? 'new'}`, {
  label: t('nav.chat'),
  onRecovered(result) {
    const last = turns.value.at(-1);
    if (last && !last.answer && active.value) {
      const reply = result as Reply;
      if (reply.answer.trim().startsWith('DOCDD_CONTEXT:')) last.stage = 'failedStage';
      else acceptReply(last, reply);
      void chats.persist(active.value);
    }
  }
});
const busy = computed(() => preparing.value || running.value);
function acceptReply(turn: Turn, result: Reply) {
  Object.assign(turn, result, { stage: 'answered', draft: chatDraft(turn.mode ?? 'ask', result.answer, turn.map) });
}

const streamingText = computed(() => log.value.filter((line) => line.kind === 'text').map((line) => line.text).join(''));
const runningProvider = computed(() => log.value.find((line) => line.kind === 'action')?.text);
function stop() {
  if (preparation) preparation.abort();
  else cancel();
}
watch(projectId, () => preparation?.abort());
onBeforeUnmount(() => preparation?.abort());
watch(() => [turns.value.length, turns.value.at(-1)?.answer, streamingText.value, workOpen.value], async () => {
  await nextTick();
  feed.value?.scrollTo({ top: feed.value.scrollHeight });
});

async function send(retry?: Turn) {
  const question = (retry?.question ?? input.value).trim();
  const chat = active.value;
  if (!question || busy.value || !chat || chat.archived) return;
  if (!retry && mode.value === 'ask' && /^(?:давай\s+)?(?:начинай|начни|возьми|бер[её]м|запусти|сделаем|реализуй)(?=\s|[.!?,:]|$)/iu.test(question)) {
    const id = question.match(/\bT-\d+\b/i)?.[0]?.toUpperCase();
    const important = /сам[а-яё]*\s+важн|приоритетн/iu.test(question);
    const target = id ? records.value.find((record) => record.type === 'task' && record.id === id)
      : important ? firstReady.value : focused.value?.type === 'task' ? focused.value : undefined;
    if (target) {
      input.value = '';
      workOpen.value = true;
      await focus('record', target.id);
      return;
    }
  }
  const project = projectId.value;
  const provider = selectedModel.value;
  if (!provider) { openModels(); return; }
  const session = chat.id;
  const api = base.value;
  const mention = question.match(/(?:^|\s)@([A-Z][A-Z0-9]*-\d+)\b/i)?.[1]?.toUpperCase();
  const mentionedRecord = records.value.find((record) => record.id === mention);
  const turn: Turn = retry ?? { question, profile: profile.value, sources: [], center: mentionedRecord?.id || selected.value || phase.value || undefined, phase: phase.value || undefined, mode: mode.value, map: mode.value === 'map' ? map.value : undefined };
  const earlier = turns.value.filter((item) => item.answer).slice(-2);
  if (!retry) {
    if (!chat.turns.length && chat.title === t('chat.newChat')) chat.title = question.slice(0, 65);
    chat.turns.push(turn);
    input.value = '';
    mode.value = 'ask';
  }
  const current = chat.turns.at(-1)!;
  const controller = new AbortController();
  preparation = controller;
  const { signal } = controller;
  preparing.value = true;
  try {
    const template = templates[current.profile];
    current.sources = [];
    current.provider = undefined;
    current.matches = undefined;
    const findCenter = async (text: string) => {
      const terms = text.match(/[\p{L}\p{N}_-]+/gu)?.filter((word) => word.length >= 3 && !searchStopWords.has(word.toLowerCase())) ?? [];
      const exact = terms.find((word) => records.value.some((item) => item.id.toLowerCase() === word.toLowerCase()));
      if (exact) return records.value.find((item) => item.id.toLowerCase() === exact.toLowerCase())?.id;
      if (!terms.length) return;
      current.stage = 'searching';
      const { hits } = await $fetch<{ hits: SearchHit[] }>(`${api}/search`, { query: { q: terms.join(' '), match: 'any' }, signal });
      const candidates = hits.filter((hit) => hit.type !== 'note');
      current.matches = candidates.length;
      return candidates[0]?.id;
    };
    const readContext = async (center?: string) => {
      if (!center) return '';
      current.stage = 'reading';
      const pack = await $fetch<Context>(`${api}/context`, {
        method: 'POST', body: { centerId: center, need: `chat-${current.profile}` }, signal
      });
      current.center = center;
      const sources = pack.chunks.filter((chunk) => !chunk.withheld && !chunk.excluded && chunk.key.startsWith('record:'))
        .map((chunk) => ({ id: chunk.key.slice(7), title: chunk.title }));
      current.sources = [...new Map([...current.sources, ...sources].map((source) => [source.id, source])).values()];
      return pack.prompt;
    };
    const center = current.center || await findCenter(question) || earlier.at(-1)?.center;
    const context = await readContext(center);
    if (signal.aborted || active.value?.id !== session) {
      current.stage = 'cancelled';
      return;
    }
    const history = earlier.filter((item) => item.center === center)
      .map((item) => [item.question.slice(0, 500), item.answer!.slice(0, 800)]);
    let drafting = '';
    if (current.mode === 'task') {
      drafting = 'Предложи одну черновую задачу, если данных достаточно. Верни блок docdd-task с JSON: title, description, expected. Если данных мало, задай вопрос без блока.';
    }
    if (current.mode === 'map' && current.map) {
      current.stage = 'reading';
      const mapId = current.map;
      const { contextToken, instructions, schema, standard, current: nodes, page } =
        await $fetch<{ contextToken: string; instructions: string; schema: unknown; standard: unknown; current: unknown; page: unknown }>(`${api}/map/context`, { query: { map: mapId, limit: 30 }, signal });
      current.mapToken = contextToken;
      drafting = `Предложи изменение только в блоке docdd-${mapId} по схеме. Если сведений мало, задай вопрос.\n${instructions}\n${JSON.stringify({ schema, standard, nodes, page })}`;
    }
    if (signal.aborted || active.value?.id !== session) {
      current.stage = 'cancelled';
      return;
    }
    const prompt = [
      template.guidance,
      `Проект: ${project}. ${context ? '' : 'Подходящие документы пока не подобраны.'}`,
      drafting,
      context,
      history.length ? `История (вопрос и ответ): ${JSON.stringify(history)}` : '',
      `Вопрос: ${question}`
    ].filter(Boolean).join('\n\n');
    current.stage = 'waiting';
    preparation = undefined;
    preparing.value = false;
    void chats.persist(chat, api + '/chat');
    const architecture = /архитектур|system[ -]design|системн\p{L}* дизайн|свер\p{L}* карт|соответств\p{L}*.*(?:код|стратег)|architecture|compare.*(?:code|map)/iu.test(question);
    const ask = (text: string) => stream<Reply>('/api/llm/ask', { projectId: project, prompt: text, tools: false, trace: true, projectChat: true, architecture, providerId: provider.id });
    let result = await ask(prompt + '\nДополнительный поиск на этом ходе доступен.');
    const lookup = result?.answer.trim().match(/^DOCDD_CONTEXT:\s*([^\r\n]{1,180})$/)?.[1];
    if (lookup && active.value?.id === session) {
      preparation = controller;
      preparing.value = true;
      const requested = await findCenter(lookup);
      const extra = requested && requested !== center ? await readContext(requested) : '';
      if (signal.aborted || active.value?.id !== session) { current.stage = 'cancelled'; return; }
      current.stage = 'waiting';
      preparation = undefined;
      preparing.value = false;
      result = await ask([prompt, extra || 'Дополнительной подходящей записи нет.', 'Лимит дополнительного поиска исчерпан. Ответь по доступным сведениям.'].join('\n\n'));
    }
    if (result && !result.answer.trim().startsWith('DOCDD_CONTEXT:')) acceptReply(current, result);
    else if (active.value?.id === session) {
      current.provider = runningProvider.value;
      current.stage = outcome.value?.kind === 'cancelled' ? 'cancelled' : 'failedStage';
    }
  } catch {
    current.stage = signal.aborted ? 'cancelled' : 'failedStage';
  } finally {
    if (preparation === controller) { preparation = undefined; preparing.value = false; }
    void chats.persist(chat, api + '/chat');
  }
}
</script>

<template>
  <section class="mx-auto grid min-h-0 w-full min-w-0 max-w-7xl grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-xl border border-default bg-default lg:grid-cols-[15rem_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
    <aside class="grid min-h-0 min-w-0 grid-cols-2 items-center gap-2 overflow-hidden border-b border-default bg-elevated/50 p-2 lg:flex lg:flex-col lg:items-stretch lg:border-r lg:border-b-0 lg:p-3">
      <UButton block variant="ghost" color="neutral" class="justify-start" icon="i-lucide-square-pen" :loading="creating" @click="newChat">{{ t('chat.newChat') }}</UButton>
      <UInput v-model="query" class="w-full" icon="i-lucide-search" :placeholder="t('chat.findChats')" :aria-label="t('chat.findChats')" />
      <UCheckbox v-model="archived" :label="t('chat.archived')" />
      <ul class="flex min-h-0 min-w-0 gap-1 overflow-auto lg:block lg:flex-1 lg:space-y-1">
        <li v-for="item in visibleChats" :key="item.id" class="max-w-40 shrink-0 lg:max-w-none">
          <NuxtLink :to="{ query: { chat: item.id } }" class="block rounded-lg px-3 py-2 text-sm hover:bg-accented"
            :class="active?.id === item.id ? 'bg-accented font-medium' : 'text-muted'" :aria-current="active?.id === item.id ? 'page' : undefined">
            <span class="block truncate" :title="item.title">{{ item.title }}</span>
            <span v-if="item.record || item.phase" class="block truncate text-xs text-muted">{{ item.record || item.phase }}</span>
          </NuxtLink>
        </li>
      </ul>
    </aside>
    <div class="flex min-h-0 min-w-0 flex-col overflow-hidden">
      <header class="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-default px-3 py-2 sm:px-5 sm:py-3">
        <div class="min-w-0 flex-1">
          <form v-if="naming" class="flex gap-2" @submit.prevent="rename">
            <UInput v-model="title" maxlength="140" class="min-w-0 flex-1" :aria-label="t('chat.rename')" />
            <UButton type="submit">{{ t('chat.saveName') }}</UButton>
          </form>
          <h1 v-else class="truncate text-base font-semibold" :title="active?.title">{{ active?.title ?? t('nav.chat') }}</h1>
          <p v-if="focused || focusedPhase" class="truncate text-sm text-muted"><template v-if="focused">{{ focused.id }} {{ focused.title }}</template><template v-if="focused && focusedPhase"> · </template><template v-if="focusedPhase">{{ focusedPhase.id }} {{ focusedPhase.title }}</template></p>
        </div>
        <div v-if="active" class="flex flex-wrap items-center gap-1">
          <UButton size="sm" variant="ghost" color="neutral" icon="i-lucide-panel-right"
            :aria-label="t('chat.sidebar')" :title="t('chat.sidebar')" @click="insertMention = false; contextOpen = true" />
          <UDropdownMenu :items="[
            { label: t('chat.rename'), onSelect: () => { title = active?.title ?? ''; naming = true; } },
            { label: t(active.archived ? 'chat.restore' : 'chat.archive'), disabled: busy, onSelect: archive }
          ]">
            <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="t('chat.manageChat')" />
          </UDropdownMenu>
        </div>
      </header>
      <div class="relative flex min-h-0 flex-1">
      <nav v-if="turns.length" :aria-label="t('chat.turnNavigation')" class="chat-scroll hidden max-h-full w-8 shrink-0 flex-col items-center overflow-y-auto py-4 sm:flex">
        <UTooltip v-for="(turn, index) in turns" :key="index" :delay-duration="150" :content="{ side: 'right', sideOffset: 6, collisionPadding: 12 }"
          :ui="{ content: 'h-auto max-w-[min(22rem,calc(100vw-3rem))] whitespace-normal px-3 py-2' }">
          <template #content>
            <span class="line-clamp-4 break-words text-left leading-relaxed">{{ turnPreview(turn) }}</span>
          </template>
          <button type="button" class="group flex h-3 w-7 shrink-0 items-center justify-center" :aria-label="turn.question" @click="jumpToTurn(index)">
            <span class="h-0.5 w-2 rounded-full bg-accented group-hover:w-4 group-hover:bg-muted group-focus-visible:w-4" />
          </button>
        </UTooltip>
      </nav>
      <div ref="feed" class="chat-scroll min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain px-3 py-4 sm:px-6">
        <div class="mx-auto max-w-3xl space-y-5">
      <p v-if="chatError" class="px-4 pt-3 text-sm text-error" role="alert">{{ chatError }}</p>
      <section v-if="active && !active.archived && priority && priority.state !== 'current'" class="border-b border-default p-4">
        <p class="mb-2 text-sm text-muted">{{ t(priority.state === 'stale' ? 'chat.priorityStale' : 'chat.priorityMissing') }}</p>
        <PromptPanel :project-id="projectId" kind="priority" :label="t('work.sort')" :hint="t('work.sortHint')">
          <template #answer="{ answer }">
            <PriorityPreview :project-id="projectId" :answer="answer" :titles="titles" :roles="projectIndex?.project.roles ?? []"
              @applied="refreshProject(); refreshPriority()" />
          </template>
        </PromptPanel>
      </section>
        <div v-if="!turns.length && !workOpen" class="mx-auto flex max-w-md flex-col items-center py-7 text-center">
          <UIcon name="i-lucide-search" class="mb-3 size-6 text-primary" />
          <h2 class="font-semibold">{{ t('chat.emptyTitle') }}</h2>
          <p class="mt-2 text-sm text-muted">{{ t('chat.empty') }}</p>
        </div>
        <article v-for="(turn, index) in turns" :key="index" :data-chat-turn="index" class="space-y-3">
          <div class="ml-auto w-fit max-w-[90%] rounded-2xl bg-primary/10 px-4 py-3">
            <p class="mb-1 text-xs text-muted">{{ t('chat.you') }}</p>
            <p class="whitespace-pre-wrap break-words text-base leading-relaxed">{{ turn.question }}</p>
          </div>
          <div class="min-w-0 space-y-2 px-1 py-3 sm:px-2">
            <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
              <UIcon name="i-lucide-activity" class="size-4 shrink-0 text-primary" />
              <span v-if="turn.stage">{{ t(`chat.${turn.stage === 'waiting' && !runningProvider && !turn.provider ? 'queued' : turn.stage}`) }}</span>
              <span v-if="turn.provider || (index === turns.length - 1 && running && runningProvider)" class="font-medium text-default">{{ turn.provider || runningProvider }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <UBadge v-if="turn.matches !== undefined" color="neutral" variant="soft">{{ t('chat.matches', { count: turn.matches }) }}</UBadge>
              <UBadge v-if="turn.center" color="neutral" variant="soft">{{ turn.center }}</UBadge>
              <UBadge v-if="turn.phase && turn.phase !== turn.center" color="neutral" variant="soft">{{ turn.phase }}</UBadge>
            </div>
            <details v-if="turn.sources.length" class="text-sm">
              <summary class="cursor-pointer text-muted">{{ t('chat.sources') }} · {{ turn.sources.length }}</summary>
              <NuxtLink v-for="source in turn.sources" :key="source.id"
                :to="`/projects/${encodeURIComponent(projectId)}/records/${encodeURIComponent(source.id)}`"
                class="mt-1 block break-words text-primary hover:underline">{{ source.id }} · {{ source.title }}</NuxtLink>
            </details>
            <ChatDraftCard v-if="turn.draft" :key="active?.id" :project-id="projectId" :draft="turn.draft"
              :context-tokens="turn.mapToken ? [turn.mapToken] : []" @changed="turn.draft = $event; active && chats.persist(active)" />
            <p v-else-if="turn.answer || (index === turns.length - 1 && running && streamingText)"
              class="whitespace-pre-wrap break-words text-base leading-relaxed">{{ turn.answer || streamingText }}</p>
            <UButton v-if="index === turns.length - 1 && !busy && (turn.stage === 'failedStage' || turn.stage === 'cancelled')"
              size="xs" variant="soft" @click="send(turn)">{{ t('chat.retry') }}</UButton>
          </div>
        </article>
        <section v-if="active && workTask && workOpen" class="min-w-0 border-t border-default pt-3">
          <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-sm font-medium">{{ workTask.id }} · {{ workTask.title }}</h2>
            <UButton size="xs" variant="ghost" @click="workOpen = false">{{ t('chat.hideWork') }}</UButton>
          </div>
          <TaskWork :key="workTask.id" :project-id="projectId" :record-id="workTask.id" :status="workTask.status"
            :chat-access="active.archived ? 'read' : access" :roles="projectIndex?.project.roles ?? []" @changed="refreshProject" />
        </section>
        </div>
      </div>
      </div>
      <div v-if="active && !active.archived" class="mx-auto w-full max-w-3xl shrink-0 space-y-2 bg-default px-3 pt-1 pb-3 sm:px-5">
        <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome?.kind === 'failure' ? outcome : null" @cancel="stop" />
        <form class="chat-composer rounded-2xl border border-default bg-elevated/60 p-2" @submit.prevent="send()">
          <UTextarea v-model="input" :rows="2" :maxlength="4000" :aria-label="t('chat.question')"
            :placeholder="t('chat.question')" variant="none" class="w-full" :ui="{ base: 'resize-none text-base' }"
            @keydown.enter.exact="!$event.isComposing && ($event.preventDefault(), send())" />
          <div class="flex flex-wrap items-center gap-2">
          <UDropdownMenu :content="{ side: 'top', align: 'start' }" :items="[
            { label: t('chat.addReference'), icon: 'i-lucide-at-sign', onSelect: () => showContext(true) },
            { label: t('chat.mode.task'), icon: 'i-lucide-list-plus', onSelect: () => { mode = 'task'; } },
            { label: t('chat.mode.map'), icon: 'i-lucide-network', onSelect: () => { mode = 'map'; } },
            { label: t('chat.mode.ask'), icon: 'i-lucide-message-circle', onSelect: () => { mode = 'ask'; } }
          ]">
            <UButton type="button" size="xs" color="neutral" variant="soft" class="rounded-full" icon="i-lucide-plus"
              :disabled="busy" :aria-label="t('chat.addToMessage')" :title="t('chat.addToMessage')" />
          </UDropdownMenu>
          <UPopover v-model:open="accessOpen" :content="{ side: 'top', align: 'start' }">
            <UButton type="button" size="xs" variant="ghost" color="neutral" :disabled="busy"
              :aria-label="t('chat.accessLabel')">{{ t(accessLabel) }}
              <UIcon name="i-lucide-chevron-down" class="size-4 transition-transform duration-200 motion-reduce:transition-none" :class="{ 'rotate-180': accessOpen }" />
            </UButton>
            <template #content>
              <div class="w-80 max-w-[calc(100vw-2rem)] space-y-1 p-2">
                <p class="px-2 py-1 text-xs font-medium text-muted">{{ t('chat.accessLabel') }}</p>
                <button v-for="option in accessOptions" :key="option.value" type="button"
                  class="flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm enabled:hover:bg-elevated disabled:opacity-60"
                  :disabled="option.value === 'full'" :aria-pressed="option.value === access"
                  @click="option.value !== 'full' && (access = option.value, accessOpen = false)">
                  <UIcon :name="option.icon" class="mt-0.5 size-4 shrink-0 text-muted" />
                  <span class="flex-1"><span class="block font-medium">{{ t(option.name) }}</span><span class="block text-xs text-muted">{{ t(option.detail) }}</span></span>
                  <UIcon v-if="option.value === access" name="i-lucide-check" class="size-4 shrink-0" />
                </button>
              </div>
            </template>
          </UPopover>
          <UButton v-if="access === 'edits' && workTask && !workOpen" size="xs" variant="soft" icon="i-lucide-play"
            @click="workOpen = true; focus('record', workTask.id)">{{ t('chat.openWork', { id: workTask.id }) }}</UButton>
          <span v-else-if="access === 'edits' && !workTask" class="text-xs text-muted">{{ t('chat.noReadyWork') }}</span>
          <span v-if="mode !== 'ask'" class="text-xs text-muted">{{ t(`chat.mode.${mode}`) }}</span>
          <USelect v-if="mode === 'map'" v-model="map" size="xs" :disabled="busy"
            :items="maps.map((value) => ({ value, label: t(`chat.map.${value}`) }))" :aria-label="t('chat.mode.map')" />
          <UButton type="button" size="xs" variant="ghost" color="neutral" trailing-icon="i-lucide-chevron-down" class="ml-auto min-w-0 max-w-52" :disabled="busy" @click="openModels">
            <span class="truncate">{{ selectedModel ? modelLabel(selectedModel) : t('chat.pickModel') }}</span>
          </UButton>
          <div class="flex shrink-0 items-center gap-2">
          <UButton v-if="preparing" type="button" variant="soft" color="neutral" @click="stop">{{ t('chat.stop') }}</UButton>
          <UButton type="submit" color="neutral" class="rounded-full" :disabled="busy || !input.trim()" icon="i-lucide-arrow-up" :aria-label="t('chat.send')" :title="t('chat.send')" />
          </div>
          </div>
        </form>
      </div>
      <div v-else-if="!loading && !active" class="border-t border-default p-4">
        <UButton icon="i-lucide-plus" :loading="creating" @click="newChat">{{ t('chat.newChat') }}</UButton>
      </div>
    </div>
    <UModal v-model:open="modelOpen" :title="t('chat.pickModel')" :description="t('chat.modelSettingsHint')">
      <template #body>
        <div class="space-y-2">
          <p v-if="!modelsLoading && !modelChoices.length" class="text-sm text-muted">{{ t('chat.noModels') }}</p>
          <ul class="max-h-64 space-y-1 overflow-auto">
            <li v-for="model in modelChoices" :key="model.id">
              <UButton variant="ghost" color="neutral" class="w-full justify-start" :disabled="refreshingModels || Object.values(checks).includes('checking')" @click="chooseModel(model.id)">
                <span class="min-w-0 flex-1 break-all text-left">{{ modelLabel(model) }}</span>
                <UBadge color="neutral" variant="soft">{{ model.kind === 'agent' ? 'CLI' : 'API' }}</UBadge>
                <UIcon v-if="checks[model.id] === 'checking'" name="i-lucide-loader-circle" class="animate-spin" :aria-label="t('chat.modelChecking')" />
                <UIcon v-else-if="checks[model.id] === 'ok'" name="i-lucide-circle-check" class="text-success" :aria-label="t('chat.modelWorking')" />
                <UIcon v-else-if="checks[model.id] === 'failed'" name="i-lucide-circle-x" class="text-error" :aria-label="t('chat.modelFailed')" />
                <UIcon v-if="model.id === selectedModel?.id" name="i-lucide-check" :aria-label="t('chat.modelChosen')" />
              </UButton>
            </li>
          </ul>
          <div class="flex flex-wrap gap-2">
            <UButton variant="soft" icon="i-lucide-settings" @click="modelOpen = false; modelSettingsOpen = true">{{ t('chat.modelSettings') }}</UButton>
            <UButton variant="ghost" color="neutral" :disabled="modelsLoading || refreshingModels || Object.values(checks).includes('checking')" @click="updateModels()">
              <UIcon name="i-lucide-refresh-cw" class="size-4" :class="{ 'motion-safe:animate-[spin_1.8s_linear_infinite]': refreshingModels }" />
              {{ t('chat.refreshModels') }}
            </UButton>
          </div>
          <p v-if="modelNotice || refreshingModels" role="status" class="text-sm text-muted">{{ refreshingModels ? t('chat.modelChecking') : modelNotice }}</p>
        </div>
      </template>
    </UModal>
    <UModal v-model:open="modelSettingsOpen" :title="t('chat.modelSettings')" :ui="{ content: 'sm:max-w-4xl' }"
      @update:open="(open) => { if (!open) { checks = {}; modelNotice = ''; openModels(); } }">
      <template #body>
        <ModelSettings v-if="modelSettingsOpen" embedded />
      </template>
    </UModal>
    <USlideover v-model:open="contextOpen" side="right" :title="t('chat.sidebar')" :description="t('chat.sidebarHint')">
      <template #body>
        <UTabs v-model="sidebarTab" :content="false" size="sm" class="mb-4"
          :ui="{ list: 'grid w-full grid-cols-3', trigger: 'min-h-9 min-w-0 justify-center px-1 text-center', label: 'whitespace-normal' }" :items="[
          { label: t('chat.context'), value: 'context', icon: 'i-lucide-folder-search' },
          { label: 'Git', value: 'git', icon: 'i-lucide-git-branch' },
          { label: t('chat.agentsTab'), value: 'agents', icon: 'i-lucide-bot' }
        ]" />
        <ChatGitPanel v-if="sidebarTab === 'git'" :project-id="projectId" />
        <ChatAgentsPanel v-else-if="sidebarTab === 'agents'" :project-id="projectId" :task-id="workTask?.id" />
        <div v-else class="min-w-0 space-y-3">
          <p class="text-sm text-muted">{{ t(insertMention ? 'chat.contextMentionHint' : 'chat.contextFocusHint') }}</p>
          <div v-if="!insertMention && (focused || focusedPhase)" class="space-y-1 rounded-lg border border-default p-3 text-sm">
            <p v-if="focused" class="break-words"><span class="text-muted">{{ t('chat.record') }}</span> · {{ focused.id }} {{ focused.title }}</p>
            <p v-if="focusedPhase" class="break-words"><span class="text-muted">{{ t('chat.phase') }}</span> · {{ focusedPhase.id }} {{ focusedPhase.title }}</p>
          </div>
          <UInput v-model="contextQuery" :autofocus="insertMention" icon="i-lucide-search" class="w-full" :placeholder="t('chat.findContext')" :aria-label="t('chat.findContext')" />
          <div class="flex flex-wrap gap-1">
            <UButton v-for="filter in filters" :key="filter" size="xs" :variant="filter === contextFilter ? 'soft' : 'ghost'"
              @click="contextFilter = filter">{{ t(`chat.filter.${filter}`) }}</UButton>
          </div>
          <p v-if="!contextResults.length" class="text-sm text-muted">{{ t('chat.contextEmpty') }}</p>
          <ul v-else ref="contextList" class="chat-scroll max-h-[40vh] overflow-y-auto overscroll-contain" @scroll.passive="onContextScroll">
            <li v-for="item in contextResults.slice(0, contextLimit)" :key="item.id">
              <button type="button" class="flex w-full min-w-0 gap-2 rounded-md px-2 py-2 text-left text-sm enabled:hover:bg-elevated disabled:opacity-60"
                :disabled="busy || active?.archived"
                @click="chooseContext(item.type === 'phase' ? 'phase' : 'record', item.id)">
                <span class="shrink-0 font-mono text-xs text-muted">{{ item.id }}</span>
                <span class="min-w-0 [overflow-wrap:anywhere]">{{ item.title }}</span>
              </button>
            </li>
            <li v-if="contextLimit < contextResults.length" class="px-2 py-1">
              <UButton type="button" size="xs" variant="ghost" color="neutral" @click="showMoreContext">{{ t('chat.contextMore', { shown: contextLimit, total: contextResults.length }) }}</UButton>
            </li>
          </ul>
          <div class="flex flex-wrap gap-1">
            <UButton v-if="selected" size="xs" variant="ghost" :disabled="busy || active?.archived" @click="focus('record', '')">{{ t('chat.unpin', { id: selected }) }}</UButton>
            <UButton v-if="phase" size="xs" variant="ghost" :disabled="busy || active?.archived" @click="focus('phase', '')">{{ t('chat.unpin', { id: phase }) }}</UButton>
          </div>
          <details class="text-sm text-muted">
            <summary class="cursor-pointer">{{ t('chat.profile') }} · {{ t(`chat.${profile}`) }}</summary>
            <USelect v-model="profile" class="my-2 w-full" :disabled="busy || active?.archived" :items="Object.keys(templates).map((value) => ({ value, label: t(`chat.${value}`) }))" />
            <USelect v-model="mode" class="my-2 w-full" :disabled="busy || active?.archived" :aria-label="t('chat.modeLabel')"
              :items="(['ask', 'task', 'map'] as const).map((value) => ({ value, label: t(`chat.mode.${value}`) }))" />
            <p>{{ t(mode === 'ask' ? 'chat.fileAccess' : 'chat.writeAccess') }}</p>
          </details>
        </div>
      </template>
    </USlideover>
  </section>
</template>

<style scoped>
.chat-composer:focus-within {
  outline: 1px solid var(--ui-text-muted);
}

.chat-composer :deep(textarea:focus-visible) {
  outline: none;
}

.chat-scroll {
  scrollbar-width: thin;
  scrollbar-color: transparent transparent;
}

.chat-scroll:hover,
.chat-scroll:focus-within {
  scrollbar-color: var(--ui-border-accented) transparent;
}
</style>
