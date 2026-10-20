<script setup lang="ts">
const props = defineProps<{ projectId: string }>();

interface Member { login: string; roles: string[]; known: boolean }
const { data } = useFetch<Member[]>(() => `/api/projects/${encodeURIComponent(props.projectId)}/team`, {
  key: () => `team:${props.projectId}`,
  default: () => []
});
const unknown = computed(() => data.value.filter((member) => !member.known));
</script>

<template>
  <UCard v-if="data.length > 0">
    <template #header>
      <h2 class="font-medium">Команда</h2>
    </template>
    <ul class="space-y-1 text-sm">
      <li v-for="member in data" :key="member.login" class="flex items-center gap-2">
        <span class="font-mono text-xs">{{ member.login }}</span>
        <UBadge v-for="role in member.roles" :key="role" color="neutral" variant="subtle" size="sm">{{ role }}</UBadge>
        <UBadge v-if="!member.known" color="warning" variant="subtle" size="sm">нет учётной записи</UBadge>
      </li>
    </ul>
    <UAlert
      v-if="unknown.length > 0"
      class="mt-3"
      color="warning"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="`Незнакомый логин: ${unknown.map((member) => member.login).join(', ')}`"
      description="В манифесте указан человек, которого нет среди учёток сервера. Заведите его на экране «Люди»."
    />
  </UCard>
</template>
