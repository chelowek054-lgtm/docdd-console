<script setup lang="ts">
import type { ApiFailure, BulkMoved } from '~/composables/useProjectIndex';
import type { IndexRecord, IssueDto } from '~~/server/lib/types';

/**
 * Панель массовых действий над отмеченными записями (docs/04-ui.md,
 * «Массовые действия»). Целевой статус каждой записи выбирает сервер; панель
 * называет число до нажатия и показывает отчёт после.
 */
const props = defineProps<{
  projectId: string;
  selected: IndexRecord[];
  total: number;
  roles: { id: string; name: string }[];
  /** Задачам «Подтвердить» не предлагается: их подтверждение — закрытие фактом. */
  kind: 'document' | 'task';
}>();

const emit = defineEmits<{ done: [results?: BulkMoved[]] }>();

interface BulkResult {
  id: string;
  ok: boolean;
  from: string;
  to: string;
  code?: string;
  message?: string;
  hint?: 'link_map';
}

interface BulkReport {
  moved: number;
  skipped: number;
  newIssues: IssueDto[];
  results: BulkResult[];
}

const actor = ref(props.roles[0]?.id ?? ''); const { me } = useMe(() => props.projectId);
const busy = ref('');
const failure = ref<ApiFailure | null>(null);
const report = ref<BulkReport | null>(null);

const empty = computed(() => props.selected.length === 0);

/**
 * Двигать можно только записи одного статуса: «вперёд» на смеси черновиков и
 * подтверждённого — это «двинуть лишнее» (docs/04-ui.md, «Списки по статусам»).
 */
const statuses = computed(() => [...new Set(props.selected.map((record) => record.status))]);
const mixed = computed(() => statuses.value.length > 1);
const blocked = computed(() => empty.value || mixed.value);
const skipped = computed(() => report.value?.results.filter((result) => !result.ok) ?? []);

/**
 * Пропущенные группируются по причине: сорок девять одинаковых строк «feature
 * без карты» не читаются, а одна группа с номерами — читается (docs/04-ui.md).
 */
const linking = ref(false);
const linked = ref<{ map: { id: string; title: string }; linked: string[] } | null>(null);
const linkFailure = ref<ApiFailure | null>(null);

/** Задачи, которым не хватает именно карты: общая карта заводится одной кнопкой (docs/04-ui.md). */
async function linkMap(ids: string[]) {
  linking.value = true;
  linkFailure.value = null;
  try {
    const response = await $fetch<{ map: { id: string; title: string }; linked: string[] } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/records/bulk/link-map`,
      { method: 'POST', body: { ids }, ignoreResponseError: true }
    );
    const problem = failureOf(response);
    if (problem) {
      linkFailure.value = problem;
      return;
    }
    linked.value = response as { map: { id: string; title: string }; linked: string[] };
    emit('done', (response as BulkReport).results);
  } finally {
    linking.value = false;
  }
}

/** «{{ t('bulk.acceptManual') }}»: задачи, которых держит только непройденная ручная проверка. */
const acceptOpen = ref(false);
const acceptIds = ref<string[]>([]);
function openAccept(ids: string[]) {
  acceptIds.value = ids;
  acceptOpen.value = true;
}

const groups = computed(() => {
  const byCode = new Map<string, BulkResult[]>();
  for (const result of skipped.value) {
    const code = result.code ?? 'unknown';
    byCode.set(code, [...(byCode.get(code) ?? []), result]);
  }
  return [...byCode.entries()].map(([code, items]) => ({
    code,
    items,
    example: items[0]?.message ?? '',
    unmapped: items.filter((item) => item.hint === 'link_map').map((item) => item.id)
  }));
});

const ACTIONS = computed(() => [
  { direction: 'forward', label: t('bulk.forward'), icon: 'i-lucide-arrow-right', title: t('bulk.forwardTitle') },
  { direction: 'back', label: t('bulk.back'), icon: 'i-lucide-arrow-left', title: t('bulk.backTitle') },
  ...(props.kind === 'document'
    ? [{ direction: 'approve', label: t('bulk.approve'), icon: 'i-lucide-check-check', title: t('bulk.approveTitle') }]
    : [])
]);

async function run(direction: string) {
  busy.value = direction;
  failure.value = null;
  report.value = null;
  linked.value = null;
  linkFailure.value = null;
  try {
    const response = await $fetch<BulkReport | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/records/bulk/status`,
      {
        method: 'POST',
        body: { ids: props.selected.map((record) => record.id), direction, actor: actor.value, versions: Object.fromEntries(props.selected.map((record) => [record.id, record.version])) },
        // Отказ приходит телом ответа: причину показываем как есть.
        ignoreResponseError: true
      }
    );
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    report.value = response as BulkReport;
    // Отметки снимаются: повторное нажатие двинуло бы переведённые ещё на шаг.
    emit('done');
  } finally {
    busy.value = '';
  }
}

const { t, tn } = useT();
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated/40 px-3 py-2">
      <p class="text-sm">
        {{ t('bulk.selected') }} <span class="font-medium">{{ props.selected.length }}</span> {{ t('bulk.of') }} {{ props.total }}
      </p>

      <UButton v-can="'approve'"
        v-for="action in ACTIONS"
        :key="action.direction"
        size="sm"
        variant="soft"
        :icon="action.icon"
        :title="action.title"
        :disabled="blocked || busy !== ''"
        :loading="busy === action.direction"
        @click="run(action.direction)"
      >
        {{ action.label }}
      </UButton>

      <!-- Прежний курс (A-0001): свой статус и своя причина, не шаг «вперёд/назад». -->
      <LegacyBulk :project-id="props.projectId" :selected="props.selected" :actor="actor" @done="emit('done')" />

      <!-- Неактивная кнопка обязана назвать причину (docs/04-ui.md). -->
      <p v-if="empty" class="min-w-0 flex-1 text-sm text-muted">{{ t('bulk.markHint') }}</p>
      <p v-else-if="mixed" class="min-w-0 flex-1 text-sm text-warning">
        {{ t('t83.bulk-bar.1', { p: statuses.map(statusLabel).join(', ') }) }}
      </p>
      <p v-else class="min-w-0 flex-1 text-sm text-muted">
        {{ t('t83.bulk-bar.2', { p: statusLabel(statuses[0] ?? '') }) }}
      </p>

      <USelect
        v-if="(props.roles.length) && !me.required"
        v-model="actor"
        size="sm"
        class="ml-auto w-48"
        :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
      /><span v-if="me.required && me.user" class="text-sm text-muted">{{ t('bulk.signedIn') }} {{ me.user.name }}</span>
    </div>

    <UAlert
      v-if="failure"
      color="error"
      variant="subtle"
      icon="i-lucide-triangle-alert"
      :title="failure.message"
      :description="failure.detail"
    />

    <UAlert
      v-if="report && !failure"
      :color="report.skipped ? 'warning' : 'success'"
      variant="subtle"
      :icon="report.skipped ? 'i-lucide-triangle-alert' : 'i-lucide-check'"
      :title="t('t83.m3.bb.moved', { moved: report.moved, total: report.results.length })"
      close
      @update:open="report = null"
    >
      <template v-if="skipped.length" #description>
        <p class="mb-1">{{ t('bulk.skipped') }} {{ skipped.length }}:</p>
        <ul class="space-y-2">
          <li v-for="group in groups" :key="group.code">
            <p><span class="font-medium">{{ group.items.length }} — <code>{{ group.code }}</code></span></p>
            <p class="text-xs">{{ group.items.length > 1 ? t('t83.m3.bb.example') : '' }}{{ group.example }}</p>
            <p class="mt-0.5">
              <NuxtLink
                v-for="result in group.items"
                :key="result.id"
                :to="`/projects/${props.projectId}/records/${result.id}`"
                class="mr-2 font-mono text-xs hover:underline"
              >{{ result.id }}</NuxtLink>
            </p>
            <UButton v-can="'approve'"
              v-if="group.code === 'task_done_unverified'"
              class="mt-2"
              size="xs"
              variant="soft"
              icon="i-lucide-hand-helping"
              @click="openAccept(group.items.map((item) => item.id))"
            >
              {{ t('bulk.acceptManual') }}
            </UButton>
            <!-- Нет карты вовсе — заводится одна общая на пачку; подтверждает её человек. -->
            <div v-if="group.unmapped.length && !linked" class="mt-2">
              <UButton v-can="'approve'"
                size="xs"
                variant="soft"
                icon="i-lucide-map-plus"
                :loading="linking"
                @click="linkMap(group.unmapped)"
              >
                {{ tn('t83.m3.bb.link', group.unmapped.length) }}
              </UButton>
              <p v-if="linkFailure" class="mt-1 text-xs">{{ linkFailure.message }}</p>
            </div>
          </li>
        </ul>
      </template>
    </UAlert>

    <ManualAcceptModal
      v-model:open="acceptOpen"
      :project-id="props.projectId"
      :task-ids="acceptIds"
      :roles="props.roles"
      @changed="emit('done')"
    />

    <UAlert
      v-if="linked"
      color="success"
      variant="subtle"
      icon="i-lucide-map-pin-check"
      :title="t('t83.m3.bb.map', { id: linked.map.id, n: linked.linked.length })"
    >
      <template #description>
        {{ t('t83.bulk-bar.3') }}
        <NuxtLink :to="`/projects/${props.projectId}/records/${linked.map.id}`" class="font-mono hover:underline">{{ linked.map.id }}</NuxtLink>{{ t('t83.bulk-bar.4') }}
      </template>
    </UAlert>

    <UAlert
      v-if="report && !failure"
      :color="report.newIssues.length ? 'error' : 'success'"
      variant="subtle"
      :icon="report.newIssues.length ? 'i-lucide-octagon-alert' : 'i-lucide-shield-check'"
      :title="report.newIssues.length ? t('t83.m3.bb.issues', { n: report.newIssues.length }) : t('bulk.noNewIssues')"
    >
      <template v-if="report.newIssues.length" #description>
        <p class="mb-1">{{ t('bulk.rollback') }}</p>
        <ul class="space-y-1">
          <li v-for="(issue, at) in report.newIssues" :key="at">
            <NuxtLink
              v-if="issue.recordId"
              :to="`/projects/${props.projectId}/records/${issue.recordId}`"
              class="font-mono hover:underline"
            >{{ issue.recordId }}</NuxtLink>
            <span class="font-mono text-xs"> {{ issue.code }}</span> — {{ issue.message }}
          </li>
        </ul>
      </template>
    </UAlert>
  </div>
</template>
