<script setup lang="ts">
const { me } = useMe(() => '');
const { data, refresh } = useFetch<{ hasUrl: boolean; fromEnv: boolean }>('/api/notifications/channel', { default: () => ({ hasUrl: false, fromEnv: false }) });

const url = ref('');
const problem = ref('');
const saved = ref(false);

async function save() {
  problem.value = '';
  saved.value = false;
  const response = await $fetch<{ error?: { message: string } }>('/api/notifications/channel', {
    method: 'PUT',
    body: { url: url.value },
    ignoreResponseError: true
  });
  if (response.error) {
    problem.value = response.error.message;
    return;
  }
  url.value = '';
  saved.value = true;
  await refresh();
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <h1 class="text-xl font-semibold">Внешний канал уведомлений</h1>
    <UAlert
      v-if="me.required && !me.user?.admin"
      color="warning"
      variant="subtle"
      title="Экран только для администратора сервера"
    />
    <UCard v-else>
      <p class="mb-3 text-sm">
        Webhook (Slack, Mattermost): на него уходит <code>{text}</code> по каждому уведомлению.
        Сейчас: {{ data.hasUrl ? 'адрес задан' : 'канал не настроен' }}<span v-if="data.fromEnv"> (из DOCDD_NOTIFY_WEBHOOK)</span>.
      </p>
      <form class="space-y-3" @submit.prevent="save">
        <UInput v-model="url" class="w-full" placeholder="https://hooks.example.com/…" />
        <UAlert v-if="problem" color="error" variant="subtle" :title="problem" />
        <UAlert v-if="saved" color="success" variant="subtle" title="Сохранено" />
        <UButton type="submit">Сохранить (пусто — отключить)</UButton>
      </form>
    </UCard>
  </div>
</template>
