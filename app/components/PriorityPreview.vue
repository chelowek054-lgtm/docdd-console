<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';

/**
 * Ответ «Сортировать по важности» таблицей: фаза → задачи с причиной у каждой строки
 * (docs/04-ui.md, «Порядок по важности»). Мнение модели: ничего не пишется, пока человек не
 * нажал «Применить порядок».
 */
interface PlanTask { id: string; why: string }
interface PlanPhase { id: string; why: string; tasks: PlanTask[] }
interface Preview { phases: PlanPhase[]; problems: string[]; fixed: string[] }

const props = defineProps<{ projectId: string; answer: string; titles: Record<string, string>; roles: { id: string; name: string }[] }>();
const emit = defineEmits<{ applied: [] }>();

const preview = ref<Preview | null>(null);
const failure = ref<ApiFailure | null>(null);
const loading = ref(false);
const applying = ref(false);
const done = ref<string[] | null>(null);
const actor = ref(props.roles[0]?.id ?? '');

async function parse() {
  loading.value = true;
  failure.value = null;
  preview.value = null;
  done.value = null;
  try {
    const response = await $fetch(`/api/projects/${props.projectId}/priority/preview`, {
      method: 'POST',
      body: { answer: props.answer },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) failure.value = problem;
    else preview.value = response as Preview;
  } finally {
    loading.value = false;
  }
}
watch(() => props.answer, parse, { immediate: true });

async function apply() {
  if (!preview.value) return;
  applying.value = true;
  failure.value = null;
  try {
    const response = await $fetch<{ changed: string[] } | { error: ApiFailure }>(`/api/projects/${props.projectId}/priority/apply`, {
      method: 'POST',
      body: { phases: preview.value.phases, actor: actor.value },
      ignoreResponseError: true
    });
    const problem = failureOf(response);
    if (problem) {
      failure.value = problem;
      return;
    }
    done.value = (response as { changed: string[] }).changed;
    emit('applied');
  } finally {
    applying.value = false;
  }
}

const title = (id: string) => props.titles[id] ?? id;
</script>

<template>
  <div class="mb-3 space-y-3">
    <p v-if="loading" class="text-sm text-muted">Разбираю ответ…</p>
    <!-- Блока нет — это не отказ: ответ остаётся текстом ниже, как раньше. -->
    <p v-else-if="failure && !preview" class="text-sm text-muted">{{ failure.message }}</p>

    <template v-else-if="preview">
      <ol class="space-y-3">
        <li v-for="(phase, at) in preview.phases" :key="phase.id" class="rounded border border-default p-3">
          <p class="text-sm font-medium">
            <span class="text-muted">{{ at + 1 }}.</span>
            <span class="font-mono text-xs"> {{ phase.id }}</span> {{ title(phase.id) }}
          </p>
          <p v-if="phase.why" class="text-xs text-muted">{{ phase.why }}</p>
          <ol class="mt-2 space-y-0.5 text-sm">
            <li v-for="(task, index) in phase.tasks" :key="task.id" class="flex flex-wrap gap-2">
              <span class="w-6 text-right text-muted">{{ index + 1 }}.</span>
              <span class="font-mono text-xs">{{ task.id }}</span>
              <span class="min-w-0 flex-1">{{ title(task.id) }}<span v-if="task.why" class="text-muted"> — {{ task.why }}</span></span>
            </li>
          </ol>
        </li>
      </ol>

      <ul v-if="preview.fixed.length" class="space-y-0.5 text-xs text-warning">
        <li v-for="(line, at) in preview.fixed" :key="at">Поправлено по зависимостям: {{ line }}</li>
      </ul>
      <ul v-if="preview.problems.length" class="space-y-0.5 text-xs text-muted">
        <li v-for="(line, at) in preview.problems" :key="at">{{ line }}</li>
      </ul>

      <div class="flex flex-wrap items-center gap-3">
        <USelect v-if="roles.length" v-model="actor" size="sm" class="w-44" :items="roles.map((role) => ({ label: role.name, value: role.id }))" />
        <UButton size="sm" icon="i-lucide-list-ordered" :loading="applying" :disabled="done !== null" @click="apply">Применить порядок</UButton>
        <p v-if="done" class="text-sm text-success">Записан порядок: фаз изменено {{ done.length }}.</p>
        <p v-else class="text-xs text-muted">Запишет rank у фаз и порядок covers; в журнале каждой изменённой фазы — строка.</p>
      </div>
      <UAlert v-if="failure" color="error" variant="subtle" icon="i-lucide-triangle-alert" :title="failure.message" :description="failure.detail" />
    </template>
  </div>
</template>
