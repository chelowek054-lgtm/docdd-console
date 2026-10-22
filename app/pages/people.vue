<script setup lang="ts">
interface Person { login: string; name: string; admin: boolean; agent?: { type: string } }

const { t } = useT();
const { me } = useMe(() => '');
const { data, refresh } = useFetch<Person[]>('/api/auth/users', { default: () => [] });
const people = computed(() => (Array.isArray(data.value) ? data.value : []));

const login = ref('');
const name = ref('');
const password = ref('');
const admin = ref(false);
/** Аккаунт агента (ADR-0033): без пароля, тип — из набора агентов. */
const isAgent = ref(false);
const agentType = ref('qa');
const AGENT_TYPE_ITEMS = ['architect', 'analyst', 'developer', 'qa', 'devops', 'designer', 'marketer', 'critic'].map((value) => ({ label: value, value }));
const problem = ref('');
const busy = ref(false);

async function add() {
  busy.value = true;
  problem.value = '';
  try {
    const response = await $fetch<{ error?: { message: string } }>('/api/auth/users', {
      method: 'POST',
      body: isAgent.value ? { login: login.value, name: name.value, agent: { type: agentType.value } } : { login: login.value, name: name.value, password: password.value, admin: admin.value },
      ignoreResponseError: true
    });
    if (response.error) {
      problem.value = response.error.message;
      return;
    }
    login.value = name.value = password.value = '';
    admin.value = false;
    isAgent.value = false;
    await refresh();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-4">
    <h1 class="text-xl font-semibold">{{ t('ppl.title') }}</h1>
    <UAlert
      v-if="me.required && !me.user?.admin"
      color="warning"
      variant="subtle"
      :title="t('ppl.adminOnly')"
    />
    <template v-else>
      <UCard>
        <ul class="space-y-1 text-sm">
          <li v-for="person in people" :key="person.login" class="flex items-center gap-2">
            <span class="font-mono text-xs">{{ person.login }}</span>
            <span>{{ person.name }}</span>
            <UBadge v-if="person.admin" color="primary" variant="subtle" size="sm">{{ t('ppl.admin') }}</UBadge>
            <UBadge v-if="person.agent" color="info" variant="subtle" size="sm" icon="i-lucide-bot">{{ t('ppl.agent', { type: person.agent.type }) }}</UBadge>
          </li>
          <li v-if="people.length === 0" class="text-muted">{{ t('ppl.none') }} <code>npm run add-user</code>.</li>
        </ul>
      </UCard>
      <UCard>
        <template #header>
          <h2 class="font-medium">{{ t('ppl.add') }}</h2>
        </template>
        <form class="space-y-3" @submit.prevent="add">
          <UInput v-model="login" :placeholder="t('login.login')" class="w-full" />
          <UInput v-model="name" :placeholder="t('ppl.name')" class="w-full" />
          <UCheckbox v-model="isAgent" :label="t('ppl.isAgent')" />
          <USelect v-if="isAgent" v-model="agentType" :items="AGENT_TYPE_ITEMS" class="w-full" />
          <p v-if="isAgent" class="text-xs text-muted">{{ t('ppl.agentHint') }}</p>
          <UInput v-if="!isAgent" v-model="password" type="password" :placeholder="t('ppl.password')" autocomplete="new-password" class="w-full" />
          <UCheckbox v-if="!isAgent" v-model="admin" :label="t('ppl.serverAdmin')" />
          <UAlert v-if="problem" color="error" variant="subtle" :title="problem" />
          <UButton type="submit" :loading="busy" :disabled="!login || (!isAgent && password.length < 8)">{{ t('ppl.save') }}</UButton>
        </form>
      </UCard>
    </template>
  </div>
</template>
