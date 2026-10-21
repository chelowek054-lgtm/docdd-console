<script setup lang="ts">
/**
 * Релизы и окружения (T-0128, R-0064): что ушло в какую версию и где выложено.
 * Данные — записи типа `release` из индекса; версия и окружения лежат в
 * незнакомых полях front matter (`extra`), задачи — по связи `ships`.
 */
const route = useRoute(); const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { records, refresh } = useProjectIndex(projectId);

const byId = computed(() => new Map(records.value.map((record) => [record.id, record])));
const releases = computed(() => records.value.filter((record) => record.type === 'release'));

function environmentsOf(extra: Record<string, unknown>): string[] {
  const value = extra['environments'];
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' && value ? [value] : [];
}

const title = ref('');
const version = ref('');
const environments = ref('');
const taskIds = ref<string[]>([]);
const failure = ref('');
const saving = ref(false);
const doneTasks = computed(() => records.value.filter((record) => record.type === 'task' && record.status === 'done'));

async function create() {
  failure.value = '';
  saving.value = true;
  try {
    await $fetch(`/api/projects/${projectId.value}/records`, {
      method: 'POST',
      body: { type: 'release', title: title.value, kind: version.value, environment: environments.value, links: { ships: taskIds.value } }
    });
    title.value = '';
    version.value = '';
    environments.value = '';
    taskIds.value = [];
    await refresh();
  } catch {
    failure.value = t('rel.failed');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-4">
    <h1 class="text-xl font-semibold">{{ t('rel.title') }}</h1>

    <form class="flex flex-wrap items-end gap-2" @submit.prevent="create">
      <UInput v-model="title" :placeholder="t('rel.name')" />
      <UInput v-model="version" :placeholder="t('rel.version')" />
      <UInput v-model="environments" :placeholder="t('rel.envs')" />
      <select v-model="taskIds" multiple class="rounded border border-default bg-default px-2 py-1 text-sm">
        <option v-for="task in doneTasks" :key="task.id" :value="task.id">{{ task.id }} · {{ task.title }}</option>
      </select>
      <UButton type="submit" :disabled="!title.trim() || !version.trim() || saving">{{ t('rel.create') }}</UButton>
    </form>
    <p v-if="failure" class="text-sm text-error">{{ failure }}</p>

    <p v-if="releases.length === 0" class="text-sm text-muted">{{ t('rel.none') }}</p>
    <UCard v-for="release in releases" :key="release.id">
      <div class="flex flex-wrap items-center gap-2">
        <NuxtLink :to="`/projects/${projectId}/records/${release.id}`" class="font-medium">{{ release.id }} · {{ release.title }}</NuxtLink>
        <UBadge color="neutral" variant="soft">{{ String(release.extra['version'] ?? '') }}</UBadge>
        <UBadge v-for="env in environmentsOf(release.extra)" :key="env" variant="subtle">{{ env }}</UBadge>
      </div>
      <ul class="mt-2 space-y-1 text-sm">
        <li v-for="id in release.links.ships ?? []" :key="id">
          <RecordLink :project-id="projectId" :record-id="id" :record="byId.get(id) ?? null" />
        </li>
      </ul>
    </UCard>
  </div>
</template>
