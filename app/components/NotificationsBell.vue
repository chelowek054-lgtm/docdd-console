<script setup lang="ts">
/**
 * Колокольчик в шапке (R-0059): число непрочитанных и список по нажатию.
 * Адресат пока «local» — когда появится вход, подставится вошедший.
 */
interface Item { id: string; at: string; text: string; read: boolean; recordId?: string }

const route = useRoute();
const projectId = computed(() => (typeof route.params['id'] === 'string' ? route.params['id'] : ''));
const open = ref(false);

const { data, refresh } = useFetch<{ items: Item[]; unread: number }>(
  () => `/api/projects/${projectId.value}/notifications`,
  { default: () => ({ items: [], unread: 0 }), server: false, immediate: Boolean(projectId.value) }
);

function toggle() {
  open.value = !open.value;
  if (open.value) void refresh();
}

async function readAll() {
  await $fetch(`/api/projects/${projectId.value}/notifications/read`, { method: 'POST', body: { to: 'local' } });
  await refresh();
}
</script>

<template>
  <div v-if="projectId" class="relative">
    <UButton
      icon="i-lucide-bell"
      size="sm"
      variant="ghost"
      :color="data.unread ? 'primary' : 'neutral'"
      :aria-label="`Уведомления: ${data.unread}`"
      @click="toggle"
    >
      <span v-if="data.unread">{{ data.unread }}</span>
    </UButton>
    <div v-if="open" class="absolute right-0 z-20 mt-1 w-80 rounded-md border border-default bg-default p-2 shadow-lg">
      <p v-if="!data.items.length" class="p-2 text-sm text-muted">Уведомлений нет</p>
      <ul v-else class="max-h-80 space-y-1 overflow-auto">
        <li v-for="item in data.items" :key="item.id" class="rounded p-2 text-sm" :class="item.read ? 'text-muted' : 'font-medium'">
          {{ item.text }}
        </li>
      </ul>
      <UButton v-if="data.unread" size="xs" variant="link" color="neutral" @click="readAll">Прочитать всё</UButton>
    </div>
  </div>
</template>
