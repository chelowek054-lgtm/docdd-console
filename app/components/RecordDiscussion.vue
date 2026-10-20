<script setup lang="ts">
/**
 * Обсуждение на карточке записи (R-0060): оставить замечание, ответить, закрыть.
 * Хранится файлом рядом с записью; текст документа не меняется.
 */
interface Reply { id: string; at: string; author: string; text: string }
interface Thread { id: string; at: string; author: string; text: string; replies: Reply[]; closed: boolean }

const props = defineProps<{ projectId: string; recordId: string }>();

const url = computed(() => `/api/projects/${props.projectId}/records/${props.recordId}/discussion`);
const { data, refresh } = useFetch<{ threads: Thread[] }>(() => url.value, {
  default: () => ({ threads: [] }),
  server: false
});

const text = ref('');
const replyText = ref<Record<string, string>>({});
const failure = ref('');

async function send(body: Record<string, string>) {
  failure.value = '';
  try {
    await $fetch(url.value, { method: 'POST', body });
    await refresh();
  } catch {
    failure.value = 'Не удалось сохранить';
  }
}

async function addThread() {
  if (!text.value.trim()) return;
  await send({ action: 'thread', text: text.value });
  text.value = '';
}

async function reply(threadId: string) {
  const value = (replyText.value[threadId] ?? '').trim();
  if (!value) return;
  await send({ action: 'reply', threadId, text: value });
  replyText.value[threadId] = '';
}
</script>

<template>
  <UCard>
    <template #header>
      <h2 class="font-medium">Обсуждение</h2>
    </template>
    <div class="space-y-3">
      <p v-if="!data.threads.length" class="text-sm text-muted">Замечаний пока нет.</p>
      <div v-for="thread in data.threads" :key="thread.id" class="rounded border border-default p-2 text-sm" :class="thread.closed ? 'opacity-60' : ''">
        <p><span class="font-medium">{{ thread.author }}</span> · {{ thread.at.slice(0, 10) }}<span v-if="thread.closed"> · закрыто</span></p>
        <p class="whitespace-pre-wrap">{{ thread.text }}</p>
        <p v-for="item in thread.replies" :key="item.id" class="ml-4 mt-1 whitespace-pre-wrap">
          <span class="font-medium">{{ item.author }}:</span> {{ item.text }}
        </p>
        <div v-if="!thread.closed" class="mt-2 flex gap-2">
          <UInput v-model="replyText[thread.id]" size="sm" class="flex-1" placeholder="Ответ" />
          <UButton size="xs" variant="soft" @click="reply(thread.id)">Ответить</UButton>
          <UButton size="xs" variant="ghost" color="neutral" @click="send({ action: 'close', threadId: thread.id })">Закрыть</UButton>
        </div>
      </div>
      <div class="flex gap-2">
        <UTextarea v-model="text" :rows="2" class="flex-1" placeholder="Новое замечание" />
        <UButton size="sm" @click="addThread">Оставить</UButton>
      </div>
      <p v-if="failure" class="text-sm text-error">{{ failure }}</p>
    </div>
  </UCard>
</template>
