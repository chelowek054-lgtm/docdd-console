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

const { data, refresh } = useFetch<ScreensReport | { error: ApiFailure }>(
  () => `/api/projects/${props.projectId}/design/screens`,
  { key: () => `design-screens:${props.projectId}` }
);
const failure = computed(() => failureOf(data.value));
const screens = computed(() => (failure.value ? null : (data.value as ScreensReport | null)));

const PASSES: { value: ScreenPass; label: string; hint: string }[] = [
  { value: 'responsive', label: 'Responsive', hint: 'скролл, обрезанное, шапка, зона нажатия 44×44, отступ из шкалы' },
  { value: 'pixel', label: 'Pixel-Perfect', hint: 'цвета ролей, кегли, отступы, радиусы и макет экрана' }
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
    label: 'Проверка экранов проекта',
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

const THEME = { light: 'светлая', dark: 'тёмная' } as const;
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
        title="Экранов нет"
        description="В подтверждённой карте пользовательских путей нет ни одного экрана. Постройте и подтвердите её на экране «Карты» — список экранов берётся оттуда."
      />

      <template v-else>
        <section class="space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-medium">Снимки экранов</h2>
            <p class="text-sm text-muted">
              есть {{ shotsPresent }} из {{ screens.total }}
              <template v-if="screens.missing"> · не хватает {{ screens.missing }}</template>
            </p>
            <UButton size="xs" variant="ghost" icon="i-lucide-refresh-cw" @click="() => refresh()">Перечитать</UButton>
          </div>
          <p class="text-sm text-muted">
            Снимки кладёт проект в <code>{{ screens.screensDir }}/&lt;экран&gt;/&lt;ширина&gt;-&lt;тема&gt;.png</code>;
            приложение их не делает, а читает. Эталонные макеты — в <code>{{ screens.mockupsDir }}</code>.
          </p>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[34rem] text-left text-sm">
              <thead class="text-xs text-muted">
                <tr>
                  <th class="pr-3">Экран</th>
                  <th class="pr-3">Макет</th>
                  <th v-for="width in screens.widths" :key="width" class="pr-3">{{ width }} px</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="screen in screens.screens" :key="screen.id" class="border-t border-default align-top">
                  <td class="py-1.5 pr-3">
                    <span class="font-mono text-xs">{{ screen.id }}</span>
                    <p v-if="screen.title !== screen.id" class="text-xs text-muted">{{ screen.title }}</p>
                  </td>
                  <td class="py-1.5 pr-3 text-xs" :class="screen.mockup ? '' : 'text-muted'">{{ screen.mockup ? 'есть' : 'нет' }}</td>
                  <td v-for="width in screens.widths" :key="width" class="py-1.5 pr-3">
                    <div class="flex flex-col gap-0.5">
                      <span
                        v-for="shot in screen.shots.filter((item) => item.width === width)"
                        :key="shot.theme"
                        class="text-xs"
                        :class="shot.present ? 'text-success' : 'text-warning'"
                        :title="shot.takenAt ?? 'снимка нет'"
                      >
                        {{ THEME[shot.theme] }}: {{ shot.present ? 'есть' : 'нет' }}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="font-medium">Проверка моделью</h2>
          <div class="flex flex-wrap items-center gap-3">
            <UButton
              v-for="pass in PASSES"
              :key="pass.value"
              size="sm"
              :variant="active === pass.value ? 'solid' : 'soft'"
              :disabled="running || shotsPresent === 0"
              :title="pass.hint"
              @click="check(pass.value)"
            >
              {{ pass.label }}
            </UButton>
            <p v-if="shotsPresent === 0" class="text-sm text-muted">Без снимков проверка не запускается.</p>
          </div>

          <ModelProgress :running="running" :elapsed="elapsed" :outcome="modelOutcome" @cancel="cancel" />
          <ModelLog :lines="log" :running="running" />

          <UAlert v-if="trouble" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="trouble.message" :description="trouble.detail" />

          <template v-if="outcome">
            <p v-for="line in outcome.problems" :key="line" class="text-sm text-warning">{{ line }}</p>

            <p v-if="outcome.findings.length === 0" class="text-sm text-muted">
              Находок нет<template v-if="outcome.clean.length">: чисто на {{ outcome.clean.join(', ') }}</template>.
            </p>
            <div v-else class="overflow-x-auto rounded border border-default">
              <table class="w-full min-w-[34rem] text-sm">
                <thead class="bg-elevated text-left text-xs text-muted">
                  <tr><th class="p-2">Экран</th><th class="p-2">Ширина</th><th class="p-2">Тема</th><th class="p-2">Что не так</th><th class="p-2">Ожидалось</th><th class="p-2">На снимке</th></tr>
                </thead>
                <tbody>
                  <tr v-for="(finding, at) in outcome.findings" :key="at" class="border-t border-default align-top">
                    <td class="p-2 font-mono text-xs">{{ finding.screen }}</td>
                    <td class="p-2">{{ finding.width }}</td>
                    <td class="p-2">{{ THEME[finding.theme] }}</td>
                    <td class="p-2">{{ finding.what }}</td>
                    <td class="p-2 text-xs text-muted">{{ finding.expected ?? '—' }}</td>
                    <td class="p-2 text-xs text-muted">{{ finding.actual ?? '—' }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="flex flex-wrap items-center gap-3">
              <UButton size="sm" :loading="saving" :disabled="!active" @click="accept">
                Принять ({{ outcome.findings.length }})
              </UButton>
              <p class="text-xs text-muted">
                Принятое ляжет отчётом проверки и попадёт в «Нарушения». Модель ничего не правит — исправление
                отдельной задачей.
              </p>
            </div>
          </template>

          <p v-if="savedReport" class="text-sm text-success">
            Принято: <code class="text-xs">{{ savedReport }}</code>. Находки видны во вкладке «Нарушения» сверки.
          </p>
        </section>

        <section class="space-y-2">
          <div class="flex flex-wrap items-center gap-3">
            <h2 class="font-medium">Скрипт снятия экранов</h2>
            <UButton size="xs" variant="ghost" :icon="copied ? 'i-lucide-check' : 'i-lucide-copy'" @click="copyScript">Скопировать</UButton>
          </div>
          <details>
            <summary class="cursor-pointer text-sm">Показать шаблон</summary>
            <pre class="mt-2 max-h-96 overflow-auto rounded bg-elevated p-3 text-xs whitespace-pre">{{ screens.script }}</pre>
          </details>
        </section>
      </template>
    </template>
  </div>
</template>
