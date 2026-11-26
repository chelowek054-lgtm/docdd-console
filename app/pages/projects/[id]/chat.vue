<script setup lang="ts">
import type { SearchHit } from '~~/server/lib/search';
import { chatDraft, type ChatDraft, type ChatMode } from '~/utils/chat-draft';

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
const { records } = useProjectIndex(projectId);
const { me } = useMe(projectId);
const chats = useProjectChats<Turn>(projectId);
const { active, summaries, error: chatError, loading } = chats;
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
const map = ref('functional');
const maps = ['functional', 'domain', 'sysdesign'];
const searchStopWords = new Set('как что кто где какой какая какие мне нужно хочу может можно сделать расскажи покажи найти my the for what how can show please this that'.split(' '));
const input = ref('');
const preparing = ref(false);
let preparation: AbortController | undefined;
const feed = ref<HTMLElement>();
const turns = computed(() => active.value?.turns ?? []);
const focused = computed(() => records.value.find((record) => record.id === selected.value));
const focusedPhase = computed(() => records.value.find((record) => record.id === phase.value));
const contextOpen = ref(false);
const contextQuery = ref('');
const contextFilter = ref('all');
const filters = ['all', 'task', 'phase', 'map', 'document'];
const contextResults = computed(() => {
  const query = contextQuery.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  return records.value.filter((item) => {
    const filter = contextFilter.value;
    if (filter === 'document' ? ['task', 'phase', 'map'].includes(item.type) : filter !== 'all' && item.type !== filter) return false;
    const haystack = (item.id + ' ' + item.title).toLowerCase();
    return query.every((part) => haystack.includes(part));
  }).slice(0, 40);
});
const query = ref('');
const archived = ref(false);
const visibleChats = computed(() => summaries.value.filter((item) =>
  item.archived === archived.value && (item.title + ' ' + item.record + ' ' + item.phase).toLowerCase().includes(query.value.trim().toLowerCase())));
const naming = ref(false);
const title = ref('');
const creating = ref(false);

watch(() => active.value?.id, () => { mode.value = 'ask'; input.value = ''; naming.value = false; });

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
watch(() => [turns.value.length, turns.value.at(-1)?.answer, streamingText.value], async () => {
  await nextTick();
  feed.value?.scrollTo({ top: feed.value.scrollHeight });
});

async function send(retry?: Turn) {
  const question = (retry?.question ?? input.value).trim();
  const chat = active.value;
  if (!question || busy.value || !chat || chat.archived) return;
  const project = projectId.value;
  const session = chat.id;
  const api = base.value;
  const turn: Turn = retry ?? { question, profile: profile.value, sources: [], center: selected.value || phase.value || undefined, phase: phase.value || undefined, mode: mode.value, map: mode.value === 'map' ? map.value : undefined };
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
    const ask = (text: string) => stream<Reply>('/api/llm/ask', { projectId: project, prompt: text, tools: false, trace: true, projectChat: true });
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
  <section class="mx-auto grid min-w-0 w-full max-w-7xl items-start gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
    <aside class="min-w-0 space-y-3 rounded-xl border border-default p-3">
      <UButton block icon="i-lucide-plus" :loading="creating" @click="newChat">{{ t('chat.newChat') }}</UButton>
      <UInput v-model="query" class="w-full" icon="i-lucide-search" :placeholder="t('chat.findChats')" :aria-label="t('chat.findChats')" />
      <UCheckbox v-model="archived" :label="t('chat.archived')" />
      <ul class="max-h-[62vh] space-y-1 overflow-auto">
        <li v-for="item in visibleChats" :key="item.id">
          <NuxtLink :to="{ query: { chat: item.id } }" class="block rounded-lg px-3 py-2 text-sm hover:bg-elevated"
            :class="active?.id === item.id ? 'bg-elevated font-medium' : ''" :aria-current="active?.id === item.id ? 'page' : undefined">
            <span class="block truncate" :title="item.title">{{ item.title }}</span>
            <span v-if="item.record || item.phase" class="block truncate text-xs text-muted">{{ item.record || item.phase }}</span>
          </NuxtLink>
        </li>
      </ul>
    </aside>
    <div class="min-w-0 overflow-hidden rounded-xl border border-default">
      <header class="flex flex-wrap items-center justify-between gap-2 border-b border-default px-5 py-4">
        <div class="min-w-0 flex-1">
          <form v-if="naming" class="flex gap-2" @submit.prevent="rename">
            <UInput v-model="title" maxlength="140" class="min-w-0 flex-1" :aria-label="t('chat.rename')" />
            <UButton type="submit">{{ t('chat.saveName') }}</UButton>
          </form>
          <h1 v-else class="break-words text-xl font-semibold">{{ active?.title ?? t('nav.chat') }}</h1>
          <p class="truncate text-sm text-muted">{{ projectId }}<template v-if="focused"> · {{ focused.id }} {{ focused.title }}</template><template v-if="focusedPhase"> · {{ focusedPhase.id }} {{ focusedPhase.title }}</template></p>
        </div>
        <div v-if="active" class="flex flex-wrap items-center gap-1">
          <UButton size="sm" variant="soft" icon="i-lucide-folder-search" :disabled="active.archived || busy"
            @click="contextQuery = ''; contextFilter = 'all'; contextOpen = true">{{ t('chat.context') }}</UButton>
          <UDropdownMenu :items="[
            { label: t('chat.rename'), onSelect: () => { title = active?.title ?? ''; naming = true; } },
            { label: t(active.archived ? 'chat.restore' : 'chat.archive'), disabled: busy, onSelect: archive }
          ]">
            <UButton size="sm" color="neutral" variant="ghost" icon="i-lucide-ellipsis" :aria-label="t('chat.manageChat')" />
          </UDropdownMenu>
        </div>
      </header>
      <p v-if="chatError" class="px-4 pt-3 text-sm text-error" role="alert">{{ chatError }}</p>
      <div ref="feed" class="h-[56vh] min-h-72 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
        <div v-if="!turns.length" class="mx-auto flex h-full max-w-md flex-col items-center justify-center text-center">
          <UIcon name="i-lucide-search" class="mb-3 size-6 text-primary" />
          <h2 class="font-semibold">{{ t('chat.emptyTitle') }}</h2>
          <p class="mt-2 text-sm text-muted">{{ t('chat.empty') }}</p>
        </div>
        <article v-for="(turn, index) in turns" :key="index" class="space-y-3">
          <div class="ml-auto w-fit max-w-[90%] rounded-xl bg-elevated px-4 py-3">
            <p class="mb-1 text-xs text-muted">{{ t('chat.you') }}</p>
            <p class="whitespace-pre-wrap break-words text-base leading-relaxed">{{ turn.question }}</p>
          </div>
          <div class="space-y-3 rounded-xl border border-default px-4 py-3">
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
      </div>
      <div v-if="active && !active.archived" class="space-y-2 border-t border-default bg-default p-4">
        <ModelProgress :running="running" :elapsed="elapsed" :outcome="outcome?.kind === 'failure' ? outcome : null" @cancel="stop" />
        <div class="flex flex-wrap items-center gap-2">
          <UDropdownMenu :items="[
            { label: t('chat.mode.ask'), onSelect: () => { mode = 'ask'; } },
            { label: t('chat.mode.task'), onSelect: () => { mode = 'task'; } },
            { label: t('chat.mode.map'), onSelect: () => { mode = 'map'; } }
          ]">
            <UButton size="xs" variant="soft" :disabled="busy" icon="i-lucide-chevron-down">{{ t(mode === 'ask' ? 'chat.actions' : `chat.mode.${mode}`) }}</UButton>
          </UDropdownMenu>
          <USelect v-if="mode === 'map'" v-model="map" size="xs" :disabled="busy"
            :items="maps.map((value) => ({ value, label: t(`chat.map.${value}`) }))" :aria-label="t('chat.mode.map')" />
        </div>
        <form class="flex flex-wrap items-end gap-2" @submit.prevent="send()">
          <UTextarea v-model="input" :rows="2" :maxlength="4000" :aria-label="t('chat.question')"
            :placeholder="t('chat.question')" class="min-w-0 flex-1" :ui="{ base: 'text-base' }"
            @keydown.enter.exact="!$event.isComposing && ($event.preventDefault(), send())" />
          <UButton v-if="preparing" variant="soft" color="neutral" @click="stop">{{ t('chat.stop') }}</UButton>
          <UButton type="submit" :disabled="busy || !input.trim()" icon="i-lucide-send" :aria-label="t('chat.send')" :title="t('chat.send')" />
        </form>
      </div>
      <div v-else-if="!loading && !active" class="border-t border-default p-4">
        <UButton icon="i-lucide-plus" :loading="creating" @click="newChat">{{ t('chat.newChat') }}</UButton>
      </div>
    </div>
    <UModal v-model:open="contextOpen" :title="t('chat.context')" :description="t('chat.localIndex')">
      <template #body>
        <div class="min-w-0 space-y-3">
          <UInput v-model="contextQuery" autofocus icon="i-lucide-search" class="w-full" :placeholder="t('chat.findContext')" :aria-label="t('chat.findContext')" />
          <div class="flex flex-wrap gap-1">
            <UButton v-for="filter in filters" :key="filter" size="xs" :variant="filter === contextFilter ? 'soft' : 'ghost'"
              @click="contextFilter = filter">{{ t(`chat.filter.${filter}`) }}</UButton>
          </div>
          <ul class="max-h-[40vh] overflow-y-auto">
            <li v-for="item in contextResults" :key="item.id">
              <button type="button" class="flex w-full min-w-0 gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-elevated"
                @click="focus(item.type === 'phase' ? 'phase' : 'record', item.id)">
                <span class="shrink-0 font-mono text-xs text-muted">{{ item.id }}</span>
                <span class="min-w-0 [overflow-wrap:anywhere]">{{ item.title }}</span>
              </button>
            </li>
          </ul>
          <div class="flex flex-wrap gap-1">
            <UButton v-if="selected" size="xs" variant="ghost" @click="focus('record', '')">{{ t('chat.unpin', { id: selected }) }}</UButton>
            <UButton v-if="phase" size="xs" variant="ghost" @click="focus('phase', '')">{{ t('chat.unpin', { id: phase }) }}</UButton>
          </div>
          <details class="text-sm text-muted">
            <summary class="cursor-pointer">{{ t('chat.profile') }} · {{ t(`chat.${profile}`) }}</summary>
            <USelect v-model="profile" class="my-2 w-full" :items="Object.keys(templates).map((value) => ({ value, label: t(`chat.${value}`) }))" />
            <p>{{ t(mode === 'ask' ? 'chat.fileAccess' : 'chat.writeAccess') }}</p>
          </details>
        </div>
      </template>
    </UModal>
  </section>
</template>
