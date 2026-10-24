<script setup lang="ts">
import type { FileFinding, FolderFinding } from '~~/server/lib/source-detect';

/**
 * Найденные источники (R-0077, docs/04-ui.md, «Автопоиск источников»): приложение
 * находит папки и файлы, человек отмечает и подтверждает — тогда они записываются в
 * `project.yaml`. Тот же компонент ведёт и экран «Импорт», когда `sources.docs` пуст.
 */
const props = defineProps<{ projectId: string; /** Только папки этого вида (экран «Импорт» — `docs`). */ only?: FolderFinding['kind'] }>();
const emit = defineEmits<{ applied: [] }>();
const { t } = useT();

interface Report { folders: FolderFinding[]; files: FileFinding[]; fresh: FolderFinding[] }
const { data, refresh, pending } = useFetch<Report>(() => `/api/projects/${props.projectId}/sources/detect`, { key: () => `sources:${props.projectId}:${props.only ?? ''}`, server: false, lazy: true });

const fresh = computed(() => (data.value?.fresh ?? []).filter((item) => !props.only || item.kind === props.only));
const picked = ref<Set<string>>(new Set());
const keyOf = (item: FolderFinding) => `${item.kind}:${item.path}`;
watch(fresh, (list) => { picked.value = new Set(list.map(keyOf)); }, { immediate: true });
const toggle = (item: FolderFinding, on: boolean | 'indeterminate') => {
  const next = new Set(picked.value);
  if (on === true) next.add(keyOf(item)); else next.delete(keyOf(item));
  picked.value = next;
};

const busy = ref(false);
const message = ref('');
async function apply() {
  busy.value = true;
  message.value = '';
  try {
    const folders = fresh.value.filter((item) => picked.value.has(keyOf(item))).map(({ kind, path }) => ({ kind, path }));
    const response = await $fetch<{ added?: Record<string, string[]>; error?: { message: string } }>(`/api/projects/${props.projectId}/sources/apply`, { method: 'POST', body: { folders }, ignoreResponseError: true });
    message.value = response.error ? response.error.message : t('src.written', { n: Object.values(response.added ?? {}).flat().length });
    if (!response.error) { await refresh(); emit('applied'); }
  } finally {
    busy.value = false;
  }
}

const KIND_ICON = { code: 'i-lucide-code', client: 'i-lucide-monitor', docs: 'i-lucide-book-open', tests: 'i-lucide-flask-conical' } as const;
const grouped = computed(() => (data.value?.files ?? []).reduce<Record<string, FileFinding[]>>((acc, file) => { (acc[file.kind] ??= []).push(file); return acc; }, {}));
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">{{ t('src.title') }}</h2>
        <UButton size="xs" variant="ghost" color="neutral" icon="i-lucide-refresh-cw" :loading="pending" :aria-label="t('src.rescan')" @click="refresh()" />
      </div>
    </template>
    <p v-if="pending && !data" class="text-sm text-muted">{{ t('src.scanning') }}</p>
    <div v-else class="space-y-4 text-sm">
      <div v-if="fresh.length" class="space-y-1">
        <p class="text-xs text-muted">{{ t('src.hint') }}</p>
        <label v-for="item in fresh" :key="keyOf(item)" class="flex items-center gap-2">
          <UCheckbox :model-value="picked.has(keyOf(item))" @update:model-value="(on) => toggle(item, on)" />
          <UIcon :name="KIND_ICON[item.kind]" class="size-4 text-muted" />
          <span class="font-mono text-xs">{{ item.path }}</span>
          <UBadge size="sm" variant="outline" color="neutral">{{ t(`src.kind.${item.kind}`) }}</UBadge>
          <span class="text-xs text-muted">{{ item.why }}</span>
        </label>
        <div class="flex items-center gap-3 pt-2">
          <UButton size="sm" :loading="busy" :disabled="picked.size === 0" @click="apply">{{ t('src.apply') }}</UButton>
          <span v-if="message" class="text-xs text-muted">{{ message }}</span>
        </div>
      </div>
      <p v-else class="text-muted">{{ data?.folders.length ? t('src.allNamed') : t('src.none') }}</p>

      <template v-if="!only">
        <div v-for="(list, kind) in grouped" :key="kind" class="space-y-0.5">
          <p class="text-xs font-medium">{{ t(`src.file.${kind}`) }} · {{ list.length }}</p>
          <p v-for="file in list.slice(0, 6)" :key="file.path" class="flex items-center gap-2 text-xs"><span class="font-mono">{{ file.path }}</span><span class="text-muted">{{ file.format }}</span></p>
          <p v-if="list.length > 6" class="text-xs text-muted">{{ t('src.more', { n: list.length - 6 }) }}</p>
        </div>
      </template>
    </div>
  </UCard>
</template>
