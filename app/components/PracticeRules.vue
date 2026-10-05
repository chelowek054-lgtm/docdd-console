<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

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

const { data } = useFetch<RulesResponse | { error: ApiFailure }>(
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
    <h2 class="font-medium">Правила проверки</h2>

    <p v-if="empty" class="text-sm text-muted">
      Правил нет ни в общих практиках, ни в решениях этого проекта: сверх соглашений о входе по языкам ничего не проверяется.
      Правило заводится блоком <code>docdd-rules</code> в подтверждённом <code>decision</code> или <code>design</code>.
    </p>

    <!-- Переходный путь: секция манифеста читается, пока нет подтверждённого блока правил. -->
    <UAlert
      v-if="rules.manifest === 'used'"
      color="warning"
      variant="subtle"
      icon="i-lucide-info"
      title="Читается секция architecture манифеста"
      description="Подтверждённых блоков правил в практиках нет. Перенесите правила в решение с блоком docdd-rules — тогда у них появится причина и источник."
    />
    <UAlert
      v-else-if="rules.manifest === 'ignored'"
      color="neutral"
      variant="subtle"
      icon="i-lucide-info"
      title="Секция architecture манифеста больше не читается"
      description="Правила идут из практик. Секцию в манифесте можно убрать."
    />

    <div v-if="local.length" class="text-sm">
      <p class="font-medium">Этого проекта</p>
      <ul class="mt-1 space-y-0.5">
        <li v-for="item in local" :key="item.id">
          <NuxtLink :to="`/projects/${projectId}/records/${item.id}`" class="font-mono hover:underline">{{ item.id }}</NuxtLink>
          <span v-if="byId.get(item.id)"> — {{ byId.get(item.id)?.title }}</span>
        </li>
      </ul>
    </div>

    <div v-if="rules.rules.length" class="overflow-x-auto">
      <p class="mb-1 text-sm font-medium">Действующие правила</p>
      <table class="w-full text-left text-xs">
        <thead class="text-muted">
          <tr><th class="pr-3">Правило</th><th class="pr-3">Значение</th><th class="pr-3">Источник</th><th>Перекрыло</th></tr>
        </thead>
        <tbody>
          <tr v-for="row in rules.rules" :key="row.key" class="border-t border-default align-top">
            <td class="py-1 pr-3 font-mono">{{ row.key }}</td>
            <td class="py-1 pr-3 font-mono">{{ shown(row.value) }}</td>
            <td class="py-1 pr-3">{{ row.source }} <span class="text-muted">· {{ row.level === 'local' ? 'локальное' : 'общее' }}</span></td>
            <td class="py-1 text-muted">{{ row.overrides.join(', ') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <ul v-if="rules.conflicts.length || rules.problems.length" class="space-y-1 text-sm text-warning">
      <li v-for="conflict in rules.conflicts" :key="conflict.key">
        Конфликт <code>rules_conflict</code>: записи {{ conflict.records.join(' и ') }} задают разное для <code>{{ conflict.key }}</code> — действует поздняя.
      </li>
      <li v-for="(problem, at) in rules.problems" :key="at">{{ problem.record }}: {{ problem.message }}</li>
    </ul>
  </div>
</template>
