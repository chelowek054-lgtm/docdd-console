<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import { fixTaskOf, selectionState } from '../../server/lib/architecture';
const { t } = useT();

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
  rule?: { key?: string; source: string } | undefined;
}

const props = defineProps<{
  projectId: string;
  report?: {
    enabled: boolean;
    findings?: Finding[];
    checked?: number;
    total?: number;
    unchecked?: Record<string, number>;
    reconcile?: { enabled: boolean; modulesWithoutCapability: string[]; capabilitiesWithoutModule: { id: string; title: string }[] };
    rules?: { manifest: 'used' | 'ignored' | 'absent'; sources: { id: string; level: 'general' | 'local' }[] };
  } | undefined;
}>();

const UNCHECKED_LABEL: Record<string, string> = {
  get missing() { return t('t83.m2.arch.missing'); },
  get unknown() { return t('t83.m2.arch.unknown'); },
  get ignored() { return t('t83.m2.arch.ignored'); }
};

const violations = computed(() => (props.report?.findings ?? []).filter((item) => item.code !== 'arch_promote'));

/** Отмеченные нарушения: по умолчанию все; снятая галочка выводит нарушение из задачи. */
const unchecked = ref<Set<string>>(new Set());
const keyOf = (item: Finding) => `${item.code}|${item.from}|${item.to}`;
const chosen = computed(() => violations.value.filter((item) => !unchecked.value.has(keyOf(item))));
function toggle(item: Finding, value: boolean | 'indeterminate') {
  const next = new Set(unchecked.value);
  if (value === true) next.delete(keyOf(item));
  else next.add(keyOf(item));
  unchecked.value = next;
}

/** «Выбрать все»: из промежуточного состояния нажатие отмечает всё, из полного — снимает. */
const allState = computed(() => selectionState(violations.value.length, chosen.value.length));
function toggleAll(value: boolean | 'indeterminate') {
  unchecked.value = value === true ? new Set() : new Set(violations.value.map(keyOf));
}

const creating = ref(false);
const taskId = ref('');
const failure = ref<ApiFailure | null>(null);

/** Одна задача `fix` на отмеченное; модель не зовётся — дальше обычный путь задачи (docs/04-ui.md). */
async function fix() {
  const task = fixTaskOf(chosen.value);
  if (!task) return;
  creating.value = true;
  failure.value = null;
  taskId.value = '';
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/records`, {
      method: 'POST',
      body: { type: 'task', title: task.title, change: 'fix', body: task.body, links: { affects: task.affects } },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    taskId.value = (response as { record?: { id: string } }).record?.id ?? '';
  } finally {
    creating.value = false;
  }
}
const hints = computed(() => (props.report?.findings ?? []).filter((item) => item.code === 'arch_promote'));
const uncheckedText = computed(() => Object.entries(props.report?.unchecked ?? {})
  .map(([reason, count]) => `${UNCHECKED_LABEL[reason] ?? reason} — ${count}`)
  .join(', '));
</script>

<template>
  <div v-if="report" class="mb-2 text-xs text-muted">
    <p v-if="!report.enabled">
      {{ t('t83.architecture-note.1') }} <code>docdd-rules</code> {{ t('t83.architecture-note.2') }}
      <NuxtLink :to="`/projects/${projectId}/shared`" class="hover:underline">{{ t('t83.architecture-note.3') }}</NuxtLink>
    </p>
    <template v-else>
      <p>
        {{ t('t83.architecture-note.4', { p: report.checked ?? 0, p2: report.total ?? 0 }) }}
        <span :class="violations.length ? 'font-semibold text-violet-600' : ''">{{ t('t83.architecture-note.5', { length: violations.length }) }}</span>
        <template v-if="hints.length"> {{ t('t83.architecture-note.6', { length: hints.length }) }}</template>
        <template v-if="uncheckedText"> {{ t('t83.architecture-note.7', { uncheckedText: uncheckedText }) }}</template>
      </p>
      <!-- По каким правилам судили: запись-источник, а не безымянное «нарушение» (docs/04-ui.md). -->
      <p v-if="report.rules">
        {{ t('t83.architecture-note.8') }}
        <template v-if="report.rules.sources.length">{{ report.rules.sources.map((source) => source.id).join(', ') }}</template>
        <template v-else-if="report.rules.manifest === 'used'">{{ t('t83.architecture-note.9') }}</template>
        <template v-else>{{ t('t83.architecture-note.10') }}</template>
        — <NuxtLink :to="`/projects/${projectId}/shared`" class="hover:underline">{{ t('t83.architecture-note.11') }}</NuxtLink>
      </p>
      <!-- Замечания сверки с функциональной картой — не нарушения: связь идёт через группы кода с полем capability. -->
      <details
        v-if="report.reconcile?.enabled && (report.reconcile.modulesWithoutCapability.length || report.reconcile.capabilitiesWithoutModule.length)"
        class="mt-1"
      >
        <summary class="cursor-pointer">
          {{ t('t83.architecture-note.12', { length: report.reconcile.modulesWithoutCapability.length, length2: report.reconcile.capabilitiesWithoutModule.length }) }}
        </summary>
        <div class="mt-1 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <div v-if="report.reconcile.modulesWithoutCapability.length">
            <p class="font-medium">{{ t('t83.architecture-note.13') }}</p>
            <ul class="mt-0.5 max-h-48 overflow-y-auto font-mono">
              <li v-for="dir in report.reconcile.modulesWithoutCapability" :key="dir">{{ dir }}</li>
            </ul>
          </div>
          <div v-if="report.reconcile.capabilitiesWithoutModule.length">
            <p class="font-medium">{{ t('t83.architecture-note.14') }}</p>
            <ul class="mt-0.5 max-h-48 overflow-y-auto">
              <li v-for="item in report.reconcile.capabilitiesWithoutModule" :key="item.id">{{ item.title }}</li>
            </ul>
          </div>
        </div>
      </details>
      <details v-if="violations.length || hints.length" class="mt-1">
        <summary class="cursor-pointer">{{ t('t83.architecture-note.15') }}</summary>
        <ul class="mt-1 space-y-1">
          <li v-for="(item, at) in [...violations, ...hints]" :key="at" class="flex items-start gap-2">
            <UCheckbox
              v-if="item.code !== 'arch_promote'"
              :model-value="!unchecked.has(keyOf(item))"
              :aria-label="t('t83.m2.arch.fix', { code: item.code })"
              @update:model-value="toggle(item, $event)"
            />
            <span v-else class="w-4 shrink-0" />
            <span><code>{{ item.code }}</code>
            <span v-if="item.evidence" class="font-mono"> {{ item.evidence.path }}:{{ item.evidence.line }}</span>
            — {{ item.message }}
            <span v-if="item.rule" class="text-violet-600"> {{ t('t83.architecture-note.16', { source: item.rule.source }) }}</span></span>
          </li>
        </ul>
      </details>
      <div class="mt-2 flex flex-wrap items-center gap-3">
        <UCheckbox
          v-if="violations.length"
          :model-value="allState"
          :label="t('t83.architecture-note.17')"
          @update:model-value="toggleAll"
        />
        <UButton size="xs" variant="soft" icon="i-lucide-wrench" :loading="creating" :disabled="chosen.length === 0" @click="fix">
          {{ t('t83.architecture-note.18', { length: chosen.length }) }}
        </UButton>
        <!-- Неактивная кнопка обязана назвать причину (docs/04-ui.md). -->
        <span v-if="chosen.length === 0">{{ violations.length === 0 ? t('t83.m2.arch.noViol') : t('t83.m2.arch.noneChosen') }}</span>
        <NuxtLink v-if="taskId" :to="`/projects/${projectId}/records/${taskId}`" class="font-medium hover:underline">
          {{ t('t83.architecture-note.19', { taskId: taskId }) }}
        </NuxtLink>
        <span v-if="failure" class="text-red-600">{{ failure.message }}</span>
      </div>
    </template>
  </div>
</template>
