<script setup lang="ts">
import { unshippedTasks } from '~~/server/lib/manager';

/**
 * Релизы и окружения (T-0128, R-0064; docs/04-ui.md, «Менеджер и Релизы»): что
 * готово к выпуску, что ушло в какую версию и где выложено. Данные — записи типа
 * `release` из индекса; версия и окружения лежат в незнакомых полях front matter
 * (`extra`), задачи — по связи `ships`.
 */
const route = useRoute(); const { t } = useT();
const projectId = computed(() => String(route.params['id'] ?? ''));
const { records, refresh } = useProjectIndex(projectId);

const byId = computed(() => new Map(records.value.map((record) => [record.id, record])));
const releases = computed(() => records.value.filter((record) => record.type === 'release').sort((a, b) => b.id.localeCompare(a.id)));
const ready = computed(() => unshippedTasks(records.value));
const showReady = ref(false);

function environmentsOf(extra: Record<string, unknown>): string[] {
  const value = extra['environments'];
  if (Array.isArray(value)) return value.map(String);
  return typeof value === 'string' && value ? [value] : [];
}

const open = ref(false);
const title = ref('');
const version = ref('');
const environments = ref('');
const taskIds = ref<string[]>([]);
const failure = ref('');
const saving = ref(false);
const doneItems = computed(() => records.value
  .filter((record) => record.type === 'task' && record.status === 'done')
  .sort((a, b) => b.id.localeCompare(a.id))
  .map((task) => ({ label: `${task.id} · ${task.title}`, value: task.id })));

/** В новый релиз по умолчанию идёт то, что готово к выпуску. */
function startNew() {
  title.value = '';
  version.value = '';
  environments.value = '';
  taskIds.value = ready.value.map((task) => task.id);
  failure.value = '';
  open.value = true;
}

async function create() {
  failure.value = '';
  saving.value = true;
  try {
    await $fetch(`/api/projects/${projectId.value}/records`, {
      method: 'POST',
      body: { type: 'release', title: title.value, kind: version.value, environment: environments.value, links: { ships: taskIds.value } }
    });
    open.value = false;
    await refresh();
  } catch {
    failure.value = t('rel.failed');
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center gap-3">
      <h1 class="text-xl font-semibold">{{ t('rel.title') }}</h1>
      <UButton class="ml-auto" icon="i-lucide-plus" @click="startNew">{{ t('rel.new') }}</UButton>
    </div>

    <!-- Готово к выпуску: закрыто, но ещё ни в одном релизе. -->
    <UCard>
      <div class="flex flex-wrap items-center gap-3">
        <UIcon name="i-lucide-package-check" class="size-5 text-primary" />
        <div class="min-w-0 flex-1">
          <p class="font-medium">{{ t('rel.ready') }}: {{ ready.length }}</p>
          <p class="text-sm text-muted">{{ t('rel.readyHint') }}</p>
        </div>
        <UButton v-if="ready.length" size="sm" variant="ghost" color="neutral" :trailing-icon="showReady ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" @click="showReady = !showReady">
          {{ showReady ? t('rel.hide') : t('rel.show') }}
        </UButton>
      </div>
      <ul v-if="showReady" class="mt-3 space-y-1 text-sm">
        <li v-for="task in ready" :key="task.id"><RecordLink :project-id="projectId" :record-id="task.id" :record="task" /></li>
      </ul>
    </UCard>

    <p v-if="releases.length === 0" class="text-sm text-muted">{{ t('rel.none') }}</p>
    <UCard v-for="release in releases" :key="release.id">
      <details>
        <summary class="flex flex-wrap items-center gap-2">
          <UIcon name="i-lucide-rocket" class="size-4 text-muted" />
          <NuxtLink :to="`/projects/${projectId}/records/${release.id}`" class="font-medium hover:text-primary" @click.stop>
            <span class="font-mono text-xs text-muted">{{ release.id }}</span> {{ release.title }}
          </NuxtLink>
          <UBadge v-if="release.extra['version']" color="primary" variant="soft">{{ String(release.extra['version']) }}</UBadge>
          <UBadge v-for="env in environmentsOf(release.extra)" :key="env" color="neutral" variant="outline">{{ env }}</UBadge>
          <span class="ml-auto flex items-center gap-2 text-xs text-muted">
            <StatusBadge :status="release.status" />
            {{ t('rel.tasks', { n: release.links.ships?.length ?? 0 }) }}
          </span>
        </summary>
        <ul class="mt-3 space-y-1 text-sm">
          <li v-for="id in release.links.ships ?? []" :key="id">
            <RecordLink :project-id="projectId" :record-id="id" :record="byId.get(id) ?? null" />
          </li>
        </ul>
      </details>
    </UCard>

    <UModal v-model:open="open" :title="t('rel.new')">
      <template #body>
        <form class="space-y-3" @submit.prevent="create">
          <UFormField :label="t('rel.name')" required><UInput v-model="title" class="w-full" autofocus /></UFormField>
          <div class="grid gap-3 sm:grid-cols-2">
            <UFormField :label="t('rel.version')" required><UInput v-model="version" placeholder="1.4.0" class="w-full" /></UFormField>
            <UFormField :label="t('rel.envs')"><UInput v-model="environments" placeholder="stage, prod" class="w-full" /></UFormField>
          </div>
          <UFormField :label="t('rel.pick')" :help="t('rel.pickHelp')">
            <USelectMenu v-model="taskIds" :items="doneItems" value-key="value" multiple class="w-full" />
          </UFormField>
          <p v-if="failure" class="text-sm text-error">{{ failure }}</p>
          <div class="flex justify-end gap-2">
            <UButton variant="ghost" color="neutral" @click="open = false">{{ t('rel.cancel') }}</UButton>
            <UButton type="submit" :loading="saving" :disabled="!title.trim() || !version.trim()">{{ t('rel.create') }}</UButton>
          </div>
        </form>
      </template>
    </UModal>
  </div>
</template>
