<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { ContrastRow, DesignCheck, DesignTokens } from '~~/server/lib/design';

/**
 * Глобальный экран «Дизайн» (docs/04-ui.md, «Дизайн»): эталон консоли и
 * проекты, которые его подключили. Живёт на уровне консоли, рядом с «Все
 * проекты», а не внутри проекта: токены ведутся один раз и спускаются вниз.
 */
interface ProjectRow {
  id: string;
  name: string;
  connected: boolean;
  hasDesign: boolean;
  tokenIssues: number;
  driftIssues: number;
  screenFindings: number;
  error: string | null;
}

interface GlobalDesign {
  standard: {
    tokens: DesignTokens;
    checks: DesignCheck[];
    contrast: ContrastRow[];
    sources: { id: string; level: string }[];
  } | null;
  projects: ProjectRow[];
}

const { data } = useFetch<GlobalDesign | { error: ApiFailure }>('/api/design', { key: 'design:global' });
const failure = computed(() => failureOf(data.value));
const design = computed(() => (failure.value ? null : (data.value as GlobalDesign | null)));

const count = (bag: object) => Object.keys(bag).length;
</script>

<template>
  <div class="space-y-6">
    <h1 class="text-xl font-semibold">Дизайн</h1>

    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else-if="design">
      <section class="space-y-3">
        <h2 class="font-medium">Эталон</h2>

        <UAlert
          v-if="!design.standard"
          color="neutral"
          variant="subtle"
          icon="i-lucide-palette"
          title="Эталона пока нет"
          description="Заведите запись design с блоком docdd-design и тегом design во встроенном источнике practices/, подтвердите её — и она появится здесь."
        />

        <template v-else>
          <p class="text-sm">
            <span v-for="(source, at) in design.standard.sources" :key="source.id" class="font-mono text-xs">{{ source.id }}<span v-if="at < design.standard.sources.length - 1">, </span></span>
            · ролей палитры: {{ count(design.standard.tokens.palette.light) }} / {{ count(design.standard.tokens.palette.dark) }}
            · кеглей: {{ count(design.standard.tokens.typography) }}
            · отступов: {{ count(design.standard.tokens.spacing) }}
            · компонентов: {{ design.standard.tokens.components.length }}
            ·
            <span :class="design.standard.checks.length ? 'font-semibold text-warning' : 'text-success'">
              находок: {{ design.standard.checks.length }}
            </span>
          </p>
          <DesignTokens :tokens="design.standard.tokens" :contrast="design.standard.contrast" :checks="design.standard.checks" />
        </template>
      </section>

      <section class="space-y-3">
        <h2 class="font-medium">Проекты</h2>
        <p v-if="!design.projects.length" class="text-sm text-muted">Проектов в консоли пока нет.</p>
        <div v-else class="overflow-x-auto">
          <table class="w-full min-w-[32rem] text-left text-sm">
            <thead class="text-xs text-muted">
              <tr>
                <th class="pr-3">Проект</th><th class="pr-3">Дизайн</th>
                <th class="pr-3">Токены</th><th class="pr-3">Файлы темы</th><th>Экраны</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="project in design.projects" :key="project.id" class="border-t border-default align-top">
                <td class="py-1.5 pr-3">
                  <NuxtLink :to="`/projects/${project.id}/design`" class="hover:underline">{{ project.name }}</NuxtLink>
                  <p v-if="project.error" class="text-xs text-error">{{ project.error }}</p>
                </td>
                <td class="py-1.5 pr-3">
                  <UBadge v-if="project.connected" color="success" variant="subtle" size="sm">подключил эталон</UBadge>
                  <UBadge v-else-if="project.hasDesign" color="neutral" variant="subtle" size="sm">только своё</UBadge>
                  <UBadge v-else color="neutral" variant="outline" size="sm">не подключён</UBadge>
                </td>
                <td class="py-1.5 pr-3" :class="project.tokenIssues ? 'text-warning' : 'text-muted'">{{ project.tokenIssues || '—' }}</td>
                <td class="py-1.5 pr-3" :class="project.driftIssues ? 'text-warning' : 'text-muted'">{{ project.driftIssues || '—' }}</td>
                <td class="py-1.5" :class="project.screenFindings ? 'text-warning' : 'text-muted'">{{ project.screenFindings || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
