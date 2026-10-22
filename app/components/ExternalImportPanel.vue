<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { confluenceNotes, jiraNotes, parseJira } from '~~/server/lib/external-import';
const { t } = useT();

/**
 * Загрузка выгрузки Jira (CSV/JSON) или страниц Confluence (HTML/Markdown) во
 * входящее (T-0047, T-0048). Файл читается в браузере, число заметок
 * показывается до отправки; на склад заметки кладёт сервер, записи из них
 * человек заводит обычным разбором входящего.
 */
const props = defineProps<{ source: 'jira' | 'confluence' | string }>();
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));
const isJira = computed(() => props.source === 'jira');

const jiraText = ref('');
const pages = ref<{ title: string; parent: string; body: string }[]>([]);
const parent = ref('');
const fileNames = ref<string[]>([]);
const problem = ref('');
const sending = ref(false);
const result = ref<number | null>(null);
const failure = ref<ApiFailure | null>(null);

/** Сколько заметок получится: тем же разбором, что и на сервере. */
const preview = computed(() => {
  try {
    if (isJira.value) return jiraText.value ? jiraNotes(parseJira(jiraText.value)).length : 0;
    return confluenceNotes(pages.value.map((page) => ({ ...page, parent: page.parent || parent.value }))).length;
  } catch { return 0; }
});

/** Название страницы: заголовок внутри файла, а нет его — имя файла. */
function pageTitle(name: string, text: string): string {
  const heading = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(text)?.[1] ?? /^#\s+(.+)$/m.exec(text)?.[1];
  return (heading ?? name.replace(/\.(html?|md|markdown)$/i, '')).replace(/<[^>]+>/g, '').trim();
}

async function onFiles(event: Event) {
  const files = [...((event.target as HTMLInputElement).files ?? [])];
  problem.value = ''; result.value = null; failure.value = null;
  fileNames.value = files.map((file) => file.name);
  const texts = await Promise.all(files.map((file) => file.text()));
  if (isJira.value) {
    jiraText.value = texts[0] ?? '';
    try { parseJira(jiraText.value); } catch (error) { problem.value = t('t83.m3.ext.bad', { error: String(error) }); jiraText.value = ''; }
  } else {
    pages.value = files.map((file, i) => ({ title: pageTitle(file.name, texts[i] ?? ''), parent: '', body: texts[i] ?? '' }));
  }
}

async function send() {
  sending.value = true; failure.value = null; result.value = null;
  try {
    const body = isJira.value
      ? { source: 'jira', text: jiraText.value }
      : { source: 'confluence', pages: pages.value.map((page) => ({ ...page, parent: page.parent || parent.value })) };
    const response = await $fetch<{ count: number } | { error: ApiFailure }>(`/api/projects/${projectId.value}/inbox/external`, { method: 'POST', body });
    if ('error' in response) failure.value = response.error; else result.value = response.count;
  } catch (error) {
    failure.value = { code: 'import_failed', message: String(error) } as ApiFailure;
  } finally { sending.value = false; }
}
</script>

<template>
  <div class="space-y-3">
    <p class="text-sm text-muted">
      {{ isJira ? t('t83.m3.ext.jira') : t('t83.m3.ext.conf') }}
    </p>
    <input type="file" :multiple="!isJira" :accept="isJira ? '.csv,.json' : '.html,.htm,.md,.markdown'" class="block text-sm" @change="onFiles">
    <UInput v-if="!isJira" v-model="parent" :placeholder="t('t83.external-import-panel.1')" class="max-w-sm" />
    <p v-if="fileNames.length" class="text-sm">{{ t('t83.external-import-panel.2', { length: fileNames.length }) }} <b>{{ preview }}</b></p>
    <p v-if="problem" class="text-sm text-error">{{ problem }}</p>
    <UButton :loading="sending" :disabled="preview === 0" @click="send">{{ t('t83.external-import-panel.3') }}</UButton>
    <p v-if="result !== null" class="text-sm">{{ t('t83.external-import-panel.4', { result: result }) }}</p>
    <p v-if="failure" class="text-sm text-error">{{ failure.message }}</p>
  </div>
</template>
