import type { ProjectChat } from '~~/server/lib/project-chat';

type ChatSummary = Omit<ProjectChat, 'turns'>;

export function useProjectChats<T>(project: Ref<string>) {
  const route = useRoute();
  const { t } = useT();
  const endpoint = computed(() => `/api/projects/${encodeURIComponent(project.value)}/chat`);
  const summaries = ref<ChatSummary[]>([]);
  const sessions = reactive<Record<string, ChatSummary & { turns: T[] }>>({});
  const active = computed(() => typeof route.query.chat === 'string' ? sessions[endpoint.value + '/' + route.query.chat] : undefined);
  const error = ref('');
  const loading = ref(true);
  const saving = new Map<string, Promise<boolean>>();

  function open(id?: string) {
    return navigateTo({ path: route.path, query: id ? { chat: id } : {} });
  }

  function persist(chat: ChatSummary & { turns: T[] }, api = endpoint.value) {
    const next = (saving.get(chat.id) ?? Promise.resolve(true)).then(async (ready) => {
      if (!ready) return false;
      try {
        const saved = await $fetch<ProjectChat>(api, { method: 'PUT', body: chat });
        chat.revision = saved.revision;
        chat.updated = saved.updated;
        const { turns: _turns, ...summary } = saved;
        if (api === endpoint.value) {
          error.value = '';
          summaries.value = [summary, ...summaries.value.filter((item) => item.id !== chat.id)];
        }
        return true;
      } catch (cause) {
        if (api === endpoint.value) error.value = failureOf((cause as { data?: unknown }).data)?.message ?? t('chat.sessionError');
        return false;
      }
    });
    saving.set(chat.id, next);
    void next.finally(() => { if (saving.get(chat.id) === next) saving.delete(chat.id); });
    return next;
  }

  async function create(focus: Pick<ChatSummary, 'record' | 'phase'> = { record: '', phase: '' }, turns: T[] = [], title = t('chat.newChat')) {
    const api = endpoint.value;
    const id = crypto.randomUUID?.() ?? [...crypto.getRandomValues(new Uint8Array(16))]
      .map((byte) => byte.toString(16).padStart(2, '0')).join('').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
    const chat = { id, title, updated: '', archived: false, revision: 0, turns, ...focus };
    if (!await persist(chat, api)) return;
    const key = api + '/' + chat.id;
    sessions[key] = chat;
    return sessions[key];
  }

  async function load(id: string) {
    const api = endpoint.value;
    const key = api + '/' + id;
    if (sessions[key]) return sessions[key];
    try {
      const chat = await $fetch<ChatSummary & { turns: T[] }>(api, { query: { chat: id } });
      if (api !== endpoint.value) return;
      sessions[key] = chat;
      return sessions[key];
    } catch {
      if (api === endpoint.value) error.value = t('chat.sessionError');
    }
  }

  let initialized = '';
  let request = 0;
  onMounted(() => watch(() => [project.value, route.query.chat, route.query.record], async () => {
    const current = ++request;
    const api = endpoint.value;
    loading.value = true;
    try {
      if (initialized !== api) {
        summaries.value = [];
        const result = await $fetch<{ chats: ChatSummary[]; owner: string }>(api);
        if (current !== request) return;
        summaries.value = result.chats;
        initialized = api;
        try {
          const key = `docdd-chat-v1:${result.owner}:${project.value}`;
          const legacy = JSON.parse(sessionStorage.getItem(key) ?? 'null') as { turns?: T[]; selected?: string; phase?: string } | null;
          if (legacy?.turns?.length && await create({ record: legacy.selected ?? '', phase: legacy.phase ?? '' }, legacy.turns, t('chat.imported'))) {
            sessionStorage.removeItem(key);
          }
        } catch { /* Unavailable browser storage does not affect server sessions. */ }
      }
      if (current !== request) return;
      if (typeof route.query.chat === 'string') await load(route.query.chat);
      else {
        const record = typeof route.query.record === 'string' ? route.query.record : '';
        const match = summaries.value.find((chat) => !chat.archived && (!record || chat.record === record || chat.phase === record));
        if (match) await open(match.id);
        else if (record) {
          const chat = await create(record.startsWith('P-') ? { phase: record, record: '' } : { record, phase: '' });
          if (chat && current === request) await open(chat.id);
        }
      }
    } catch {
      if (current === request) error.value = t('chat.sessionError');
    } finally {
      if (current === request) loading.value = false;
    }
  }, { immediate: true }));

  return { active, summaries, error, loading, open, persist, create, load };
}
