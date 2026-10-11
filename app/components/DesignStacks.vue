<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { StackReport } from '~~/server/utils/design-service';

/**
 * Стеки проекта (docs/04-ui.md, «Дизайн»): для каждого объявленного в манифесте
 * стека — текст выгрузки токенов по файлам, версия токенов против версии файла
 * проекта и сверка. Файл приложение не пишет (ADR-0022): «Скопировать» отдаёт
 * текст человеку, а «Завести задачу» — модели, которая меняет файл в своей ветке.
 */
const props = defineProps<{ projectId: string }>();

const { t } = useT();

const { data, refresh } = useFetch<{ stacks: StackReport[] } | { error: ApiFailure }>(
  () => `/api/projects/${props.projectId}/design/export`,
  { key: () => `design-export:${props.projectId}` }
);
const failure = computed(() => failureOf(data.value));
const stacks = computed(() => (failure.value ? [] : ((data.value as { stacks: StackReport[] } | null)?.stacks ?? [])));

const STATE_COLOR: Record<string, 'success' | 'warning' | 'neutral' | 'error'> = {
  in_sync: 'success',
  drift: 'warning',
  missing: 'warning',
  unknown: 'error'
};

const copied = ref('');
async function copy(key: string, text: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    setTimeout(() => { if (copied.value === key) copied.value = ''; }, 1500);
  } catch {
    // Буфер недоступен (не https, запрет браузера): текст остаётся на экране, его можно выделить.
  }
}

const creating = ref('');
const created = ref<Record<string, string>>({});
const trouble = ref<ApiFailure | null>(null);

/** Задача модели на приведение файлов стека к выгрузке: текст ожидаемых файлов — в теле. */
async function makeTask(stack: StackReport) {
  const drifting = stack.files.filter((file) => file.state !== 'in_sync' && file.state !== 'unknown');
  if (!drifting.length) return;
  creating.value = stack.id;
  trouble.value = null;
  const text = [
    `Привести файлы темы стека «${stack.label}» к выгрузке токенов дизайна v${stack.version} (docs/16-design-system.md).`,
    'Содержимое файлов ниже — точное; другого в файлах быть не должно. Файл с блоком между метками',
    '`docdd-design:start` и `docdd-design:end` меняется только внутри блока, остальное в нём не трогать.',
    '',
    ...drifting.flatMap((file) => [`### \`${file.path}\``, '', '```', file.content.trimEnd(), '```', ''])
  ].join('\n');
  try {
    const response = await $fetch<{ record?: { id: string } } | { error: ApiFailure }>(`/api/projects/${props.projectId}/records`, {
      method: 'POST',
      body: { type: 'task', title: `Привести файлы темы ${stack.label} к токенам дизайна v${stack.version}`, change: 'fix', body: text },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) trouble.value = problem;
    else {
      const record = (response as { record?: { id: string } }).record;
      if (record) created.value = { ...created.value, [stack.id]: record.id };
    }
  } finally {
    creating.value = '';
  }
}
</script>

<template>
  <div class="space-y-6">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">{{ t('dst.title') }}</h2>
        <UButton size="xs" variant="ghost" icon="i-lucide-refresh-cw" @click="() => refresh()">{{ t('dst.reread') }}</UButton>
      </div>

      <UAlert
        v-if="!stacks.length"
        color="neutral"
        variant="subtle"
        icon="i-lucide-layers"
        :title="t('dst.none.title')"
        :description="t('dst.none.text')"
      />

      <UAlert v-if="trouble" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="trouble.message" :description="trouble.detail" />

      <section v-for="stack in stacks" :key="stack.id" class="space-y-3 rounded border border-default p-4">
        <div class="flex flex-wrap items-center gap-3">
          <h3 class="font-medium">{{ stack.label }} <span class="font-mono text-xs text-muted">{{ stack.id }}</span></h3>
          <UBadge color="primary" variant="subtle" size="sm">{{ t('dst.tokensVersion', { version: stack.version }) }}</UBadge>
          <UButton
            v-if="stack.files.some((file) => file.state === 'drift' || file.state === 'missing')"
            class="ml-auto"
            size="sm"
            variant="soft"
            icon="i-lucide-list-plus"
            :loading="creating === stack.id"
            @click="makeTask(stack)"
          >
            {{ t('dst.makeTask') }}
          </UButton>
          <NuxtLink v-if="created[stack.id]" :to="`/projects/${projectId}/records/${created[stack.id]}`" class="text-sm hover:underline">
            {{ t('dst.created', { id: created[stack.id]! }) }}
          </NuxtLink>
        </div>

        <details v-if="stack.changes.length" class="text-sm">
          <summary class="cursor-pointer">{{ t('dst.changes', { count: stack.changes.length }) }}</summary>
          <ul class="mt-2 space-y-1">
            <li v-for="change in stack.changes" :key="`${change.version}:${change.summary}`" class="flex flex-wrap gap-x-3">
              <span class="font-mono text-xs">v{{ change.version }}</span>
              <span>{{ change.summary }}</span>
            </li>
          </ul>
        </details>

        <div v-for="file in stack.files" :key="file.key" class="space-y-2 border-t border-default pt-3">
          <div class="flex flex-wrap items-center gap-2">
            <code class="text-xs">{{ file.path }}</code>
            <UBadge :color="STATE_COLOR[file.state] ?? 'neutral'" variant="subtle" size="sm">{{ t(`dst.state.${file.state}`) }}</UBadge>
            <span v-if="file.fileVersion" class="text-xs text-muted">{{ t('dst.fileVersion', { version: file.fileVersion }) }}</span>
            <UButton
              class="ml-auto"
              size="xs"
              variant="ghost"
              :icon="copied === `${stack.id}:${file.key}` ? 'i-lucide-check' : 'i-lucide-copy'"
              @click="copy(`${stack.id}:${file.key}`, file.content)"
            >
              {{ t('common.copy') }}
            </UButton>
          </div>
          <details v-if="file.diff">
            <summary class="cursor-pointer text-sm">{{ t('dst.diff') }}</summary>
            <pre class="mt-2 max-h-96 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre">{{ file.diff }}</pre>
          </details>
          <details>
            <summary class="cursor-pointer text-sm">{{ t('dst.text') }}</summary>
            <pre class="mt-2 max-h-96 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre">{{ file.content }}</pre>
          </details>
        </div>
      </section>
    </template>
  </div>
</template>
