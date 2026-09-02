<script setup lang="ts">
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
        <h1 class="text-xl font-semibold">Нарушения</h1>
        <UBadge color="error" variant="subtle">{{ errors.length }} ошибок</UBadge>
        <UBadge color="warning" variant="subtle">{{ warnings.length }} предупреждений</UBadge>
      </div>

      <div class="flex flex-wrap gap-2">
        <USelect
          v-model="only"
          class="w-52"
          :items="[
            { label: 'Всё', value: 'all' },
            { label: 'Только ошибки', value: 'error' },
            { label: 'Только предупреждения', value: 'warning' }
          ]"
        />
        <USelect
          v-model="code"
          class="w-64"
          placeholder="Любой код"
          :items="codes.map((item) => ({ label: item, value: item }))"
        />
        <UButton v-if="code" variant="ghost" color="neutral" @click="code = ''">Сбросить код</UButton>
      </div>

      <div class="flex flex-wrap items-center gap-3">
        <UButton size="sm" variant="ghost" color="neutral" @click="chosen = shown.map(issueKey)">
          Отметить всё на экране
        </UButton>
        <UButton v-if="chosen.length" size="sm" variant="ghost" color="neutral" @click="chosen = []">
          Снять отметки
        </UButton>
      </div>

      <!-- Чинится отмеченное, а не всё под фильтром: у нарушений разная цена
           ошибки, и выбор — работа человека (docs/04-ui.md). -->
      <PromptPanel
        :project-id="projectId"
        kind="fix"
        :issues="picked"
        :label="picked.length ? `Исправить: ${picked.length}` : 'Исправить'"
        :hint="picked.length ? `отмечено: ${picked.length}` : 'отметьте нарушения флажками'"
        :disabled="picked.length === 0"
        disabled-reason="Не отмечено ни одного нарушения. Чинить «всё сразу» приложение не предлагает: решать, за какое браться, — ваша работа."
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
        empty="Нарушений нет. Документы и код говорят одно и то же."
      />
    </template>
  </div>
</template>
