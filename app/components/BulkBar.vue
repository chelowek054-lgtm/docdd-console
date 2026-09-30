<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
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

const emit = defineEmits<{ done: [] }>();

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

const actor = ref(props.roles[0]?.id ?? '');
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
    emit('done');
  } finally {
    linking.value = false;
  }
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
  { direction: 'forward', label: 'Вперёд', icon: 'i-lucide-arrow-right', title: 'Каждую отмеченную запись — на один шаг вперёд' },
  { direction: 'back', label: 'Назад', icon: 'i-lucide-arrow-left', title: 'Каждую отмеченную запись — на один шаг назад' },
  ...(props.kind === 'document'
    ? [{ direction: 'approve', label: 'Подтвердить', icon: 'i-lucide-check-check', title: 'Каждую — до «подтверждён», из черновика через «на подтверждение»' }]
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
        body: { ids: props.selected.map((record) => record.id), direction, actor: actor.value },
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
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap items-center gap-3 rounded-lg border border-default bg-elevated/40 px-3 py-2">
      <p class="text-sm">
        Выбрано: <span class="font-medium">{{ props.selected.length }}</span> из {{ props.total }}
      </p>

      <UButton
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

      <!-- Неактивная кнопка обязана назвать причину (docs/04-ui.md). -->
      <p v-if="empty" class="min-w-0 flex-1 text-sm text-muted">Отметьте записи флажками.</p>
      <p v-else-if="mixed" class="min-w-0 flex-1 text-sm text-warning">
        Отмечены записи в разных статусах ({{ statuses.map(statusLabel).join(', ') }}) —
        откройте вкладку одного статуса или снимите отметку с лишнего.
      </p>
      <p v-else class="min-w-0 flex-1 text-sm text-muted">
        все {{ statusLabel(statuses[0] ?? '') }}
      </p>

      <USelect
        v-if="props.roles.length"
        v-model="actor"
        size="sm"
        class="ml-auto w-48"
        :items="props.roles.map((role) => ({ label: role.name, value: role.id }))"
      />
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
      :title="`Переведено ${report.moved} из ${report.results.length}`"
      close
      @update:open="report = null"
    >
      <template v-if="skipped.length" #description>
        <p class="mb-1">Пропущено {{ skipped.length }}:</p>
        <ul class="space-y-2">
          <li v-for="group in groups" :key="group.code">
            <p><span class="font-medium">{{ group.items.length }} — <code>{{ group.code }}</code></span></p>
            <p class="text-xs">{{ group.items.length > 1 ? 'Например: ' : '' }}{{ group.example }}</p>
            <p class="mt-0.5">
              <NuxtLink
                v-for="result in group.items"
                :key="result.id"
                :to="`/projects/${props.projectId}/records/${result.id}`"
                class="mr-2 font-mono text-xs hover:underline"
              >{{ result.id }}</NuxtLink>
            </p>
            <!-- Нет карты вовсе — заводится одна общая на пачку; подтверждает её человек. -->
            <div v-if="group.unmapped.length && !linked" class="mt-2">
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-map-plus"
                :loading="linking"
                @click="linkMap(group.unmapped)"
              >
                Завести карту и привязать {{ plural(group.unmapped.length, 'задачу', 'задачи', 'задач') }}
              </UButton>
              <p v-if="linkFailure" class="mt-1 text-xs">{{ linkFailure.message }}</p>
            </div>
          </li>
        </ul>
      </template>
    </UAlert>

    <UAlert
      v-if="linked"
      color="success"
      variant="subtle"
      icon="i-lucide-map-pin-check"
      :title="`Заведена карта ${linked.map.id}, привязано задач: ${linked.linked.length}`"
    >
      <template #description>
        Это черновик: карту подтверждает человек —
        <NuxtLink :to="`/projects/${props.projectId}/records/${linked.map.id}`" class="font-mono hover:underline">{{ linked.map.id }}</NuxtLink>.
        После подтверждения нажмите «Вперёд» на вкладке «В очереди».
      </template>
    </UAlert>

    <UAlert
      v-if="report && !failure"
      :color="report.newIssues.length ? 'error' : 'success'"
      variant="subtle"
      :icon="report.newIssues.length ? 'i-lucide-octagon-alert' : 'i-lucide-shield-check'"
      :title="report.newIssues.length ? `Появилось нарушений: ${report.newIssues.length}` : 'Новых нарушений нет'"
    >
      <template v-if="report.newIssues.length" #description>
        <p class="mb-1">Откат — обратная кнопка по тем же записям.</p>
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
