<script setup lang="ts">
const { t } = useT();
// Вкладка «Нарушения» экрана «Сверка»: проверки, результат, нарушения и граф на одном экране (docs/04-ui.md, «Навигация»).
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { index, failure, errors, warnings, refresh } = useProjectIndex(projectId);

const only = ref<'all' | 'error' | 'warning'>('all');
const code = ref('');

const all = computed(() => index.value?.issues ?? []);

/** Отмеченные нарушения: чинить будут их, а не всё под фильтром. */
const chosen = ref<string[]>([]);

function pick(key: string) {
  chosen.value = chosen.value.includes(key)
    ? chosen.value.filter((item) => item !== key)
    : [...chosen.value, key];
}
const codes = computed(() => [...new Set(all.value.map((issue) => issue.code))].sort());

/** Ошибки сверху: кнопкой их не обойти, и порядок это подчёркивает. */
/** Нарушения по отмеченным ключам: в них же и граница починки. */
const picked = computed(() => shown.value.filter((issue) => chosen.value.includes(issueKey(issue))));

const shown = computed(() => all.value
  .filter((issue) => (only.value === 'all' || issue.severity === only.value))
  .filter((issue) => (!code.value || issue.code === code.value))
  .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'error' ? -1 : 1)));
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="text-lg font-semibold">{{ t('t83.issues-panel.1') }}</h2>
        <UBadge color="error" variant="subtle">{{ t('t83.issues-panel.2', { length: errors.length }) }}</UBadge>
        <UBadge color="warning" variant="subtle">{{ t('t83.issues-panel.3', { length: warnings.length }) }}</UBadge>
      </div>

      <div class="flex flex-wrap gap-2">
        <USelect
          v-model="only"
          class="w-52"
          :items="[
            { label: t('t83.m3.iss.all'), value: 'all' },
            { label: t('t83.m3.iss.err'), value: 'error' },
            { label: t('t83.m3.iss.warn'), value: 'warning' }
          ]"
        />
        <USelect
          v-model="code"
          class="w-64"
          :placeholder="t('t83.issues-panel.4')"
          :items="codes.map((item) => ({ label: item, value: item }))"
        />
        <UButton v-if="code" variant="ghost" color="neutral" @click="code = ''">{{ t('t83.issues-panel.5') }}</UButton>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton size="sm" variant="ghost" color="neutral" @click="chosen = shown.map(issueKey)">
          {{ t('t83.issues-panel.6') }}
        </UButton>
        <UButton v-if="chosen.length" size="sm" variant="ghost" color="neutral" @click="chosen = []">
          {{ t('t83.issues-panel.7') }}
        </UButton>
      </div>

      <!-- Чинится отмеченное, а не всё под фильтром: у нарушений разная цена
           ошибки, и выбор — работа человека (docs/04-ui.md). -->
      <PromptPanel
        :project-id="projectId"
        kind="fix"
        :issues="picked"
        :label="picked.length ? t('t83.m3.iss.fix', { n: picked.length }) : t('t83.m3.iss.fix0')"
        :hint="picked.length ? t('t83.m3.iss.picked', { n: picked.length }) : t('t83.m3.iss.pick')"
        :disabled="picked.length === 0"
        :disabled-reason="t('t83.m3.iss.why')"
      >
        <!-- Починка начинается с подтверждения плана (adr/0010). -->
        <template #answer="{ answer }">
          <FixWork
            :project-id="projectId"
            :plan="answer"
            :issues="picked"
            :roles="index?.project.roles ?? []"
            @changed="refresh"
          />
        </template>
      </PromptPanel>

      <IssueList
        :project-id="projectId"
        :issues="shown"
        :chosen="chosen"
        @pick="pick"
        :empty="t('t83.m3.iss.empty')"
      />
    </template>
  </div>
</template>
