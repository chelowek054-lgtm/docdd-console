<script setup lang="ts">
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, errors, warnings } = useProjectIndex(projectId);

const only = ref<'all' | 'error' | 'warning'>('all');
const code = ref('');

const all = computed(() => index.value?.issues ?? []);
const codes = computed(() => [...new Set(all.value.map((issue) => issue.code))].sort());

/** Ошибки сверху: кнопкой их не обойти, и порядок это подчёркивает. */
const shown = computed(() => all.value
  .filter((issue) => (only.value === 'all' || issue.severity === only.value))
  .filter((issue) => (!code.value || issue.code === code.value))
  .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1)));
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Нарушения</h1>
        <UBadge color="error" variant="subtle">{{ errors.length }} ошибок</UBadge>
        <UBadge color="warning" variant="subtle">{{ warnings.length }} предупреждений</UBadge>
      </div>

      <div class="flex flex-wrap gap-2">
        <USelect
          v-model="only"
          class="w-52"
          :items="[
            { label: 'Всё', value: 'all' },
            { label: 'Только ошибки', value: 'error' },
            { label: 'Только предупреждения', value: 'warning' }
          ]"
        />
        <USelect
          v-model="code"
          class="w-64"
          placeholder="Любой код"
          :items="codes.map((item) => ({ label: item, value: item }))"
        />
        <UButton v-if="code" variant="ghost" color="neutral" @click="code = ''">Сбросить код</UButton>
      </div>

      <IssueList
        :project-id="projectId"
        :issues="shown"
        empty="Нарушений нет. Документы и код говорят одно и то же."
      />
    </template>
  </div>
</template>
