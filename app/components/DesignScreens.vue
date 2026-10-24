<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { FindingsOutcome, ScreenPass } from '~~/server/lib/design-screens';
import type { ScreensReport } from '~~/server/utils/design-screens-service';

/**
 * Проверка экранов (docs/04-ui.md, «Дизайн»; docs/16-design-system.md): опись
 * снимков «экран · ширина · тема · когда снят», шаблон скрипта снятия и два
 * прохода моделью — Responsive и Pixel-Perfect. Модель только находит; находки
 * разбираются таблицей, и «Принять» записывает отчёт, а не правит экран.
 * Снимков приложение не делает: их кладёт проект.
 */
const props = defineProps<{ projectId: string }>();

const { t } = useT();

const { data, refresh } = useFetch<ScreensReport | { error: ApiFailure }>(
  () => `/api/projects/${props.projectId}/design/screens`,
  { key: () => `design-screens:${props.projectId}` }
);
const failure = computed(() => failureOf(data.value));
const screens = computed(() => (failure.value ? null : (data.value as ScreensReport | null)));

const PASSES: { value: ScreenPass; label: string; hint: string }[] = [
  { value: 'responsive', label: 'Responsive', hint: 'dsc.pass.responsive' },
  { value: 'pixel', label: 'Pixel-Perfect', hint: 'dsc.pass.pixel' }
];

const active = ref<ScreenPass | null>(null);
const trouble = ref<ApiFailure | null>(null);
const outcome = ref<FindingsOutcome | null>(null);
const said = ref('');
const saving = ref(false);
const savedReport = ref('');

const { running, elapsed, outcome: modelOutcome, log, stream, cancel } = useModelRequest(
  () => `${props.projectId}:design-screens`,
  {
    label: t('t83.m7.ds.label'),
    onRecovered: (answer) => afterAnswer(answer as { answer: string })
  }
);

async function check(pass: ScreenPass) {
  trouble.value = null;
  outcome.value = null;
  savedReport.value = '';
  active.value = pass;

  const built = await $fetch<{ prompt: string } | { error: ApiFailure }>(`/api/projects/${props.projectId}/prompt`, {
    method: 'POST',
    body: { kind: pass === 'responsive' ? 'design-responsive' : 'design-pixel' },
    ignoreResponseError: true
  });
  const problem = failureOf(built);
  if (problem) {
    trouble.value = problem;
    return;
  }

  // Модель читает снимки по путям в корне проекта, а не получает их в запросе.
  const answer = await stream<{ answer: string }>('/api/llm/ask', {
    prompt: (built as { prompt: string }).prompt,
    projectId: props.projectId
  });
  if (answer) await afterAnswer(answer);
}

async function afterAnswer(answer: { answer: string }) {
  const parsed = await $fetch<FindingsOutcome | { error: ApiFailure }>(`/api/projects/${props.projectId}/design/findings/preview`, {
    method: 'POST',
    body: { answer: answer.answer },
    ignoreResponseError: true
  });
  const problem = failureOf(parsed);
  if (problem) {
    trouble.value = problem;
    return;
  }
  outcome.value = parsed as FindingsOutcome;
  said.value = answer.answer;
  if (outcome.value.pass) active.value = outcome.value.pass;
}

async function accept() {
  if (!outcome.value || !active.value) return;
  saving.value = true;
  trouble.value = null;
  try {
    const response = await $fetch<{ ok: true; report: string } | { error: ApiFailure }>(
      `/api/projects/${props.projectId}/design/findings/apply`,
      {
        method: 'POST',
        body: { pass: active.value, findings: outcome.value.findings, clean: outcome.value.clean, actor: 'architect' },
        ignoreResponseError: true
      }
    );
    const problem = failureOf(response);
    if (problem) {
      trouble.value = problem;
      return;
    }
    savedReport.value = (response as { report: string }).report;
    outcome.value = null;
    await refresh();
  } finally {
    saving.value = false;
  }
}

/** Имя темы для человека: базовые — на языке интерфейса, добавленные — как названы. */
const themeText = (name: string) => (name === 'light' ? t('dt.theme.light') : name === 'dark' ? t('dt.theme.dark') : name);
const copied = ref(false);
async function copyScript() {
  if (!screens.value) return;
  try {
    await navigator.clipboard.writeText(screens.value.script);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 1500);
  } catch {
    // Буфер недоступен: скрипт остаётся на экране, его можно выделить.
  }
}

const shotsPresent = computed(() => (screens.value ? screens.value.total - screens.value.missing : 0));
</script>

<template>
  <div class="space-y-6">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else-if="screens">
      <UAlert
        v-if="!screens.fromMap"
        color="neutral"
        variant="subtle"
        icon="i-lucide-monitor-smartphone"
        :title="t('dsc.none.title')"
        :description="t('dsc.none.text')"
      />

      <template v-else>
        <section class="space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-medium">{{ t('dsc.shots.title') }}</h2>
            <p class="text-sm text-muted">
              {{ t('dsc.shots.have', { have: shotsPresent, total: screens.total }) }}
              <template v-if="screens.missing"> · {{ t('dsc.shots.missing', { count: screens.missing }) }}</template>
            </p>
            <UButton size="xs" variant="ghost" icon="i-lucide-refresh-cw" @click="() => refresh()">{{ t('dsc.reread') }}</UButton>
          </div>
          <p class="text-sm text-muted">{{ t('dsc.shots.lead', { dir: screens.screensDir, mockups: screens.mockupsDir }) }}</p>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[34rem] text-left text-sm">
              <thead class="text-xs text-muted">
                <tr>
                  <th class="pr-3">{{ t('dsc.col.screen') }}</th>
                  <th class="pr-3">{{ t('dsc.col.mockup') }}</th>
                  <th v-for="width in screens.widths" :key="width" class="pr-3">{{ width }} px · {{ Math.round((width / 16) * 100) / 100 }}rem</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="screen in screens.screens" :key="screen.id" class="border-t border-default align-top">
                  <td class="py-1.5 pr-3">
                    <span class="font-mono text-xs">{{ screen.id }}</span>
                    <p v-if="screen.title !== screen.id" class="text-xs text-muted">{{ screen.title }}</p>
                  </td>
                  <td class="py-1.5 pr-3 text-xs" :class="screen.mockup ? '' : 'text-muted'">{{ screen.mockup ? t('common.yes') : t('common.no') }}</td>
                  <td v-for="width in screens.widths" :key="width" class="py-1.5 pr-3">
                    <div class="flex flex-col gap-0.5">
                      <span
                        v-for="shot in screen.shots.filter((item) => item.width === width)"
                        :key="shot.theme"
                        class="text-xs"
                        :class="shot.present ? 'text-success' : 'text-warning'"
                        :title="shot.takenAt ?? t('dsc.shots.noShot')"
                      >
                        {{ themeText(shot.theme) }}: {{ shot.present ? t('common.yes') : t('common.no') }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="font-medium">{{ t('dsc.check.title') }}</h2>
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              v-for="pass in PASSES"
              :key="pass.value"
              size="sm"
              :variant="active === pass.value ? 'solid' : 'soft'"
              :disabled="running || shotsPresent === 0"
              :title="t(pass.hint)"
              @click="check(pass.value)"
            >
              {{ pass.label }}
            </UButton>
            <p v-if="shotsPresent === 0" class="text-sm text-muted">{{ t('dsc.check.noShots') }}</p>
          </div>

          <ModelProgress :running="running" :elapsed="elapsed" :outcome="modelOutcome" @cancel="cancel" />
          <ModelLog :lines="log" :running="running" />

          <UAlert v-if="trouble" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="trouble.message" :description="trouble.detail" />

          <template v-if="outcome">
            <p v-for="line in outcome.problems" :key="line" class="text-sm text-warning">{{ line }}</p>

            <p v-if="outcome.findings.length === 0" class="text-sm text-muted">
              {{ t('dsc.findings.none') }}<template v-if="outcome.clean.length">: {{ t('dsc.findings.clean', { list: outcome.clean.join(', ') }) }}</template>.
            </p>
            <div v-else class="ds-card overflow-x-auto">
              <table class="w-full min-w-[34rem] text-sm">
                <thead class="bg-elevated text-left text-xs text-muted">
                  <tr>
                    <th class="p-2">{{ t('dsc.col.screen') }}</th>
                    <th class="p-2">{{ t('dsc.col.width') }}</th>
                    <th class="p-2">{{ t('dsc.col.theme') }}</th>
                    <th class="p-2">{{ t('dsc.col.what') }}</th>
                    <th class="p-2">{{ t('dsc.col.expected') }}</th>
                    <th class="p-2">{{ t('dsc.col.actual') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(finding, at) in outcome.findings" :key="at" class="border-t border-default align-top">
                    <td class="p-2 font-mono text-xs">{{ finding.screen }}</td>
                    <td class="p-2">{{ finding.width }}</td>
                    <td class="p-2">{{ themeText(finding.theme) }}</td>
                    <td class="p-2">{{ finding.what }}</td>
                    <td class="p-2 text-xs text-muted">{{ finding.expected ?? '—' }}</td>
                    <td class="p-2 text-xs text-muted">{{ finding.actual ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <UButton size="sm" :loading="saving" :disabled="!active" @click="accept">
                {{ t('dsc.accept', { count: outcome.findings.length }) }}
              </UButton>
              <p class="text-xs text-muted">{{ t('dsc.accept.note') }}</p>
            </div>
          </template>

          <p v-if="savedReport" class="text-sm text-success">
            {{ t('dsc.accepted') }} <code class="text-xs">{{ savedReport }}</code>
          </p>
        </section>

        <section class="space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-medium">{{ t('dsc.script.title') }}</h2>
            <UButton size="xs" variant="ghost" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyScript">{{ t('common.copy') }}</UButton>
          </div>
          <details>
            <summary class="cursor-pointer text-sm">{{ t('dsc.script.show') }}</summary>
            <pre class="mt-2 max-h-96 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre">{{ screens.script }}</pre>
          </details>
        </section>
      </template>
    </template>
  </div>
</template>
