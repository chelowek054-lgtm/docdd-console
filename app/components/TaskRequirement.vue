<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { lacksRequirement, requirementChoices, unapprovedRequirements, withImplements } from '~~/server/lib/task-order';
import type { IndexRecord, RecordAction } from '~~/server/lib/types';

/**
 * «Привести задачу в порядок» (docs/04-ui.md, «Запись»): у задачи нет `implements`,
 * и шаг вперёд заблокирован — выбрать требование или завести новое прямо тут,
 * не уходя в файл. Текст требования приложение не пишет и модель не зовёт.
 */
const props = defineProps<{
  projectId: string;
  task: IndexRecord;
  actions: RecordAction[];
  records: IndexRecord[];
}>();

const emit = defineEmits<{ changed: [] }>();

const query = ref(''); const { t } = useT();
const newTitle = ref(props.task.title);
const busy = ref('');
const failure = ref<ApiFailure | null>(null);

const choices = computed(() => requirementChoices(props.records, query.value));
/** Форма нужна, пока `implements` пуст и это мешает шагу; закрытой или отменённой задаче она ни к чему. */
const lacks = computed(() => lacksRequirement(props.actions) && (props.task.links.implements ?? []).length === 0);
const drafts = computed(() => unapprovedRequirements(props.task.links, (id) => props.records.find((record) => record.id === id)?.status));
const titleOf = (id: string) => props.records.find((record) => record.id === id)?.title ?? '';

async function link(requirementId: string) {
  const response = await $fetch(`/api/projects/${props.projectId}/records/${props.task.id}`, {
    method: 'PATCH',
    body: { links: withImplements(props.task.links, requirementId), version: props.task.version },
    ignoreResponseError: true
  });
  const problem = failureOf(response);
  if (problem) {
    failure.value = problem;
    return false;
  }
  return true;
}

async function choose(requirementId: string) {
  busy.value = requirementId;
  failure.value = null;
  try {
    if (await link(requirementId)) emit('changed');
  } finally {
    busy.value = '';
  }
}

async function create() {
  const title = newTitle.value.trim();
  if (!title) return;
  busy.value = 'new';
  failure.value = null;
  try {
    const created = await $fetch<{ record?: { id: string } } | { error: ApiFailure }>(`/api/projects/${props.projectId}/records`, {
      method: 'POST',
      body: { type: 'requirement', title },
      ignoreResponseError: true
    });
    const problem = failureOf(created);
    if (problem) {
      failure.value = problem;
      return;
    }
    const id = (created as { record?: { id: string } }).record?.id;
    if (!id) return;
    // Требование уже заведено: если связать не вышло, называем его, чтобы не создавать второе.
    if (await link(id)) emit('changed');
    else failure.value = { code: 'link_failed', message: t('tr.linkFailed', { id, msg: failure.value?.message ?? '' }) };
  } finally {
    busy.value = '';
  }
}
</script>

<template>
  <UCard v-if="lacks || drafts.length">
    <template #header>
      <h2 class="font-medium">{{ t('tr.title') }}</h2>
    </template>

    <div v-if="lacks" class="space-y-4">
      <p class="text-sm text-muted">
        {{ t('tr.lacks') }}
      </p>

      <div class="space-y-2">
        <UInput v-model="query" size="sm" class="w-full" :placeholder="t('tr.find')" />
        <p v-if="choices.length === 0" class="text-sm text-muted">{{ t('tr.noneFit') }}</p>
        <ul v-else class="space-y-1">
          <li v-for="item in choices" :key="item.id" class="flex flex-wrap items-center gap-3 text-sm">
            <span class="font-mono text-xs text-muted">{{ item.id }}</span>
            <span class="min-w-0 flex-1">{{ item.title }}</span>
            <StatusBadge :status="item.status" />
            <UButton size="xs" variant="soft" :loading="busy === item.id" :disabled="busy !== ''" @click="choose(item.id)">
              {{ t('tr.link') }}
            </UButton>
          </li>
        </ul>
      </div>

      <div class="space-y-2 border-t border-default pt-3">
        <p class="text-sm font-medium">{{ t('tr.orCreate') }}</p>
        <div class="flex flex-wrap items-center gap-3">
          <UInput v-model="newTitle" size="sm" class="min-w-64 flex-1" :placeholder="t('tr.newTitle')" />
          <UButton size="sm" :loading="busy === 'new'" :disabled="busy !== '' || !newTitle.trim()" @click="create">
            {{ t('tr.createLink') }}
          </UButton>
        </div>
        <p class="text-xs text-muted">{{ t('tr.draftNote') }}</p>
      </div>
    </div>

    <!-- В `ready` задача не уйдёт и с неподтверждённым требованием. -->
    <p v-if="drafts.length" class="text-sm" :class="{ 'mt-3': lacks }">
      <template v-for="(id, at) in drafts" :key="id">
        <template v-if="at > 0">; </template>
        {{ t('tr.requirement') }}
        <NuxtLink :to="`/projects/${projectId}/records/${id}`" class="font-mono hover:underline">{{ id }}</NuxtLink>
        <template v-if="titleOf(id)"> «{{ titleOf(id) }}»</template>
        {{ t('tr.inDraft') }}
      </template>
      .
    </p>

    <UAlert
      v-if="failure"
      class="mt-4"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />
  </UCard>
</template>
