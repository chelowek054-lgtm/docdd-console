<script setup lang="ts">
const { t } = useT();
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
    <h1 class="text-xl font-semibold">{{ t('t83.notifications.1') }}</h1>
    <UAlert
      v-if="me.required && !me.user?.admin"
      color="warning"
      variant="subtle"
      :title="t('t83.notifications.2')"
    />
    <UCard v-else>
      <p class="mb-3 text-sm">
        {{ t('t83.notifications.3') }} <code>{text}</code> {{ t('t83.m4.nt.each') }}
        {{ t('t83.m4.nt.now') }} {{ data.hasUrl ? t('t83.m4.nt.url') : t('t83.m4.nt.none') }}<span v-if="data.fromEnv"> {{ t('t83.notifications.4') }}</span>.
      </p>
      <form class="space-y-3" @submit.prevent="save">
        <UInput v-model="url" class="w-full" placeholder="https://hooks.example.com/…" />
        <UAlert v-if="problem" color="error" variant="subtle" :title="problem" />
        <UAlert v-if="saved" color="success" variant="subtle" :title="t('t83.notifications.5')" />
        <UButton type="submit">{{ t('t83.notifications.6') }}</UButton>
      </form>
    </UCard>
  </div>
</template>
