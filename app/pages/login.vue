<script setup lang="ts">
const { t } = useT();
const login = ref('');
const password = ref('');
const problem = ref('');
const busy = ref(false);

async function submit() {
  busy.value = true;
  problem.value = '';
  try {
    const response = await $fetch<{ error?: { message: string } }>('/api/auth/login', {
      method: 'POST',
      body: { login: login.value, password: password.value },
      ignoreResponseError: true
    });
    if (response.error) {
      problem.value = response.error.message;
      return;
    }
    await navigateTo('/', { external: true });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-sm space-y-4 py-16">
    <h1 class="text-xl font-semibold">{{ t('login.title') }}</h1>
    <form class="space-y-3" @submit.prevent="submit">
      <UInput v-model="login" :placeholder="t('login.login')" autocomplete="username" class="w-full" />
      <UInput v-model="password" type="password" :placeholder="t('login.password')" autocomplete="current-password" class="w-full" />
      <UAlert v-if="problem" color="error" variant="subtle" :title="problem" />
      <UButton type="submit" :loading="busy" :disabled="!login || !password">{{ t('login.submit') }}</UButton>
    </form>
  </div>
</template>
