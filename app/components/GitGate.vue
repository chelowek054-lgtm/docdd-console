<script setup lang="ts">
/**
 * Git при подключении (R-0094, docs/04-ui.md, «Подключение»): формат заводится в
 * репозитории. Нет репозитория — консоль предлагает `git init` с ветки `main`,
 * но только по кнопке: без согласия человека ничего не создаётся.
 */
const props = defineProps<{ root: string }>();
const ready = defineModel<boolean>({ default: false });
const { t } = useT();

const checking = ref(false);
const busy = ref(false);
const failure = ref('');
const branch = ref<string | null>(null);

async function check() {
  if (!props.root.trim()) return;
  checking.value = true;
  failure.value = '';
  try {
    const response = await $fetch<{ repo?: boolean; branch?: string | null; error?: { message: string } }>('/api/projects/git-status', { query: { root: props.root.trim() }, ignoreResponseError: true });
    if (response.error) failure.value = response.error.message;
    ready.value = response.repo === true;
    branch.value = response.branch ?? null;
  } finally {
    checking.value = false;
  }
}

async function createRepo() {
  busy.value = true;
  failure.value = '';
  try {
    const response = await $fetch<{ repo?: boolean; error?: { message: string } }>('/api/projects/git-init', { method: 'POST', body: { root: props.root.trim(), consent: true }, ignoreResponseError: true });
    if (response.error) failure.value = response.error.message;
    await check();
  } finally {
    busy.value = false;
  }
}

watch(() => props.root, check, { immediate: true });
</script>

<template>
  <div class="text-sm">
    <p v-if="checking" class="text-muted">{{ t('git.checking') }}</p>
    <p v-else-if="ready" class="flex items-center gap-1 text-success"><UIcon name="i-lucide-git-branch" class="size-4" />{{ branch ? t('git.ready', { branch }) : t('git.readyEmpty') }}</p>
    <UAlert v-else color="warning" variant="subtle" icon="i-lucide-git-branch" :title="t('git.missing')" :description="t('git.missingHint')">
      <template #actions>
        <UButton size="xs" :loading="busy" @click="createRepo">{{ t('git.create') }}</UButton>
      </template>
    </UAlert>
    <p v-if="failure" class="mt-1 text-error">{{ failure }}</p>
  </div>
</template>
