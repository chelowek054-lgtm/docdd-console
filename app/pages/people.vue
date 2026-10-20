<script setup lang="ts">
interface Person { login: string; name: string; admin: boolean }

const { me } = useMe(() => '');
const { data, refresh } = useFetch<Person[]>('/api/auth/users', { default: () => [] });
const people = computed(() => (Array.isArray(data.value) ? data.value : []));

const login = ref('');
const name = ref('');
const password = ref('');
const admin = ref(false);
const problem = ref('');
const busy = ref(false);

async function add() {
  busy.value = true;
  problem.value = '';
  try {
    const response = await $fetch<{ error?: { message: string } }>('/api/auth/users', {
      method: 'POST',
      body: { login: login.value, name: name.value, password: password.value, admin: admin.value },
      ignoreResponseError: true
    });
    if (response.error) {
      problem.value = response.error.message;
      return;
    }
    login.value = name.value = password.value = '';
    admin.value = false;
    await refresh();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <h1 class="text-xl font-semibold">Люди</h1>
    <UAlert
      v-if="me.required && !me.user?.admin"
      color="warning"
      variant="subtle"
      title="Экран только для администратора сервера"
    />
    <template v-else>
      <UCard>
        <ul class="space-y-1 text-sm">
          <li v-for="person in people" :key="person.login" class="flex items-center gap-2">
            <span class="font-mono text-xs">{{ person.login }}</span>
            <span>{{ person.name }}</span>
            <UBadge v-if="person.admin" color="primary" variant="subtle" size="sm">администратор</UBadge>
          </li>
          <li v-if="people.length === 0" class="text-muted">Учёток нет. Первого администратора заводит <code>npm run add-user</code>.</li>
        </ul>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-medium">Завести человека</h2>
        </template>
        <form class="space-y-3" @submit.prevent="add">
          <UInput v-model="login" placeholder="Логин" class="w-full" />
          <UInput v-model="name" placeholder="Имя" class="w-full" />
          <UInput v-model="password" type="password" placeholder="Пароль, от 8 символов" autocomplete="new-password" class="w-full" />
          <UCheckbox v-model="admin" label="Администратор сервера" />
          <UAlert v-if="problem" color="error" variant="subtle" :title="problem" />
          <UButton type="submit" :loading="busy" :disabled="!login || password.length < 8">Сохранить</UButton>
        </form>
      </UCard>
    </template>
  </div>
</template>
