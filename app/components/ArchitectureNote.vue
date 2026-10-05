<script setup lang="ts">
/**
 * Строка проверки архитектуры над схемой кода (docs/04-ui.md, «Архитектура на
 * карте кода»): сколько импортов проверено из скольких — чтобы тишина не
 * выглядела как «всё хорошо» — и список нарушений словами. Нет секции
 * `architecture` — приглашение её добавить.
 */
interface Finding {
  code: string;
  from: string;
  to: string;
  message: string;
  evidence?: { path: string; line: number } | undefined;
  map?: string | undefined;
}

const props = defineProps<{
  report?: {
    enabled: boolean;
    findings?: Finding[];
    checked?: number;
    total?: number;
    unchecked?: Record<string, number>;
    reconcile?: { enabled: boolean; modulesWithoutCapability: string[]; capabilitiesWithoutModule: { id: string; title: string }[] };
  } | undefined;
}>();

const UNCHECKED_LABEL: Record<string, string> = {
  missing: 'файл не найден',
  unknown: 'язык не опознан'
};

const violations = computed(() => (props.report?.findings ?? []).filter((item) => item.code !== 'arch_promote'));
const hints = computed(() => (props.report?.findings ?? []).filter((item) => item.code === 'arch_promote'));
const uncheckedText = computed(() => Object.entries(props.report?.unchecked ?? {})
  .map(([reason, count]) => `${UNCHECKED_LABEL[reason] ?? reason} — ${count}`)
  .join(', '));
</script>

<template>
  <div v-if="report" class="mb-2 text-xs text-muted">
    <p v-if="!report.enabled">
      Правила архитектуры не заданы: добавьте секцию <code>architecture</code> в <code>docs/development/project.yaml</code> —
      тогда импорты карты проверятся на «через вход», слои и общий код.
    </p>
    <template v-else>
      <p>
        Архитектура: проверено {{ report.checked ?? 0 }} из {{ report.total ?? 0 }} импортов ·
        <span :class="violations.length ? 'font-semibold text-violet-600' : ''">нарушений {{ violations.length }}</span>
        <template v-if="hints.length"> · подсказок «поднять» {{ hints.length }}</template>
        <template v-if="uncheckedText"> · не проверено: {{ uncheckedText }}</template>
      </p>
      <!-- Замечания сверки с функциональной картой — не нарушения: связь идёт через группы кода с полем capability. -->
      <p v-if="report.reconcile?.enabled && (report.reconcile.modulesWithoutCapability.length || report.reconcile.capabilitiesWithoutModule.length)" class="mt-1">
        Сверка с функциональной картой:
        <template v-if="report.reconcile.modulesWithoutCapability.length">
          модули без возможности — {{ report.reconcile.modulesWithoutCapability.map((dir) => `\`${dir}\``).join(', ') }}.
        </template>
        <template v-if="report.reconcile.capabilitiesWithoutModule.length">
          Возможности без модуля — {{ report.reconcile.capabilitiesWithoutModule.map((item) => item.title).join(', ') }}.
        </template>
      </p>
      <details v-if="violations.length || hints.length" class="mt-1">
        <summary class="cursor-pointer">Показать находки</summary>
        <ul class="mt-1 space-y-1">
          <li v-for="(item, at) in [...violations, ...hints]" :key="at">
            <code>{{ item.code }}</code>
            <span v-if="item.evidence" class="font-mono"> {{ item.evidence.path }}:{{ item.evidence.line }}</span>
            — {{ item.message }}
          </li>
        </ul>
      </details>
    </template>
  </div>
</template>
