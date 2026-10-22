<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
const { t } = useT();

/**
 * Правила проверки в практиках (docs/04-ui.md, «Правила в практиках»;
 * docs/12-practice-rules.md): записи этого проекта с блоком `docdd-rules` и
 * итог сложения «минимум → общие → локальные» — у каждого правила источник и
 * то, что оно перекрыло. Экран ничего не пишет.
 */
interface RuleRow {
  key: string;
  value: unknown;
  source: string;
  level: 'general' | 'local';
  overrides: string[];
}

interface RulesResponse {
  rules: RuleRow[];
  sources: { id: string; level: 'general' | 'local' }[];
  conflicts: { key: string; records: string[] }[];
  problems: { record: string; message: string }[];
  manifest: 'used' | 'ignored' | 'absent';
}

const props = defineProps<{ projectId: string }>();

const { data } = useLazyFetch<RulesResponse | { error: ApiFailure }>(
  () => `/api/projects/${props.projectId}/rules`,
  { key: () => `rules:${props.projectId}` }
);
const rules = computed(() => (data.value && 'rules' in data.value ? data.value : null));
const { byId } = useProjectIndex(() => props.projectId);

const local = computed(() => (rules.value?.sources ?? []).filter((source) => source.level === 'local'));
const shown = (value: unknown) => (typeof value === 'string' ? value : JSON.stringify(value));
const empty = computed(() => !!rules.value && rules.value.rules.length === 0 && rules.value.manifest === 'absent');
</script>

<template>
  <div v-if="rules" class="space-y-3">
    <h2 class="font-medium">{{ t('t83.practice-rules.1') }}</h2>

    <p v-if="empty" class="text-sm text-muted">
      {{ t('t83.practice-rules.2') }} <code>docdd-rules</code> {{ t('t83.practice-rules.3') }} <code>decision</code> {{ t('t83.practice-rules.4') }} <code>design</code>.
    </p>

    <!-- Переходный путь: секция манифеста читается, пока нет подтверждённого блока правил. -->
    <UAlert
      v-if="rules.manifest === 'used'"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('t83.practice-rules.5')"
      :description="t('t83.practice-rules.6')"
    />
    <UAlert
      v-else-if="rules.manifest === 'ignored'"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      :title="t('t83.practice-rules.7')"
      :description="t('t83.practice-rules.8')"
    />

    <div v-if="local.length" class="text-sm">
      <p class="font-medium">{{ t('t83.practice-rules.9') }}</p>
      <ul class="mt-1 space-y-0.5">
        <li v-for="item in local" :key="item.id">
          <NuxtLink :to="`/projects/${projectId}/records/${item.id}`" class="font-mono hover:underline">{{ item.id }}</NuxtLink>
          <span v-if="byId.get(item.id)"> — {{ byId.get(item.id)?.title }}</span>
        </li>
      </ul>
    </div>

    <div v-if="rules.rules.length" class="overflow-x-auto">
      <p class="mb-1 text-sm font-medium">{{ t('t83.practice-rules.10') }}</p>
      <table class="w-full text-left text-xs">
        <thead class="text-muted">
          <tr><th class="pr-3">{{ t('t83.practice-rules.11') }}</th><th class="pr-3">{{ t('t83.practice-rules.12') }}</th><th class="pr-3">{{ t('t83.practice-rules.13') }}</th><th>{{ t('t83.practice-rules.14') }}</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rules.rules" :key="row.key" class="border-t border-default align-top">
            <td class="py-1 pr-3 font-mono">{{ row.key }}</td>
            <td class="py-1 pr-3 font-mono">{{ shown(row.value) }}</td>
            <td class="py-1 pr-3">{{ row.source }} <span class="text-muted">· {{ row.level === 'local' ? t('t83.m3.pr.local') : t('t83.m3.pr.shared') }}</span></td>
            <td class="py-1 text-muted">{{ row.overrides.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul v-if="rules.conflicts.length || rules.problems.length" class="space-y-1 text-sm text-warning">
      <li v-for="conflict in rules.conflicts" :key="conflict.key">
        {{ t('t83.practice-rules.15') }} <code>rules_conflict</code>: {{ t('t83.m3.pr.conflict', { records: conflict.records.join(', ') }) }} <code>{{ conflict.key }}</code> {{ t('t83.practice-rules.16') }}
      </li>
      <li v-for="(problem, at) in rules.problems" :key="at">{{ problem.record }}: {{ problem.message }}</li>
    </ul>
  </div>
</template>
