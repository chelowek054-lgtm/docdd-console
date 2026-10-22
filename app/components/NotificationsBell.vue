<script setup lang="ts">
/**
 * Колокольчик в шапке (R-0059): число непрочитанных и список по нажатию.
 * Кто читает, решает сервер: вошедший видит своё, без входа — все уведомления
 * проекта. Всплывающее окно закрывается по клику вне и по Esc.
 */
interface Item { id: string; at: string; text: string; read: boolean; recordId?: string }

const { t } = useT();
const route = useRoute();
const projectId = computed(() => (typeof route.params['id'] === 'string' ? route.params['id'] : ''));
const open = ref(false);

const { data, refresh } = useFetch<{ items: Item[]; unread: number }>(
  () => `/api/projects/${projectId.value}/notifications`,
  { default: () => ({ items: [], unread: 0 }), server: false, immediate: Boolean(projectId.value) }
);

watch(open, (value) => { if (value) void refresh(); });

async function readAll() {
  await $fetch(`/api/projects/${projectId.value}/notifications/read`, { method: 'POST', body: {} });
  await refresh();
}
</script>

<template>
  <UPopover v-if="projectId" v-model:open="open" :content="{ align: 'end' }">
    <UButton
      icon="i-lucide-bell"
      size="sm"
      variant="ghost"
      :color="data.unread ? 'primary' : 'neutral'"
      :aria-label="t('nt.aria', { n: data.unread })"
    >
      <span v-if="data.unread">{{ data.unread }}</span>
    </UButton>
    <template #content>
      <div class="w-80 p-2">
        <p v-if="!data.items.length" class="p-2 text-sm text-muted">{{ t('nt.empty') }}</p>
        <ul v-else class="max-h-80 space-y-1 overflow-auto">
          <li v-for="item in data.items" :key="item.id">
            <NuxtLink
              v-if="item.recordId"
              :to="`/projects/${projectId}/records/${item.recordId}`"
              class="block rounded p-2 text-sm hover:bg-elevated"
              :class="item.read ? 'text-muted' : 'font-medium'"
              @click="open = false"
            >{{ item.text }}</NuxtLink>
            <p v-else class="rounded p-2 text-sm" :class="item.read ? 'text-muted' : 'font-medium'">{{ item.text }}</p>
          </li>
        </ul>
        <UButton v-if="data.unread" size="xs" variant="link" color="neutral" @click="readAll">{{ t('nt.readAll') }}</UButton>
      </div>
    </template>
  </UPopover>
</template>
