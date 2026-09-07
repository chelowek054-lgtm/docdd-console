<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { SharedSourceView } from '~~/server/utils/shared-service';

/**
 * Практики: decision/design из других DocDD-проектов, читаемые для справки
 * (docs/11-shared-sources.md). Экран только читает — заводить и подтверждать
 * записи здесь нельзя, источник открывают своим отдельным проектом.
 */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { data } = useFetch<{ sources: SharedSourceView[] } | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/shared`,
  { key: () => `shared:${projectId.value}` }
);

const failure = computed(() => failureOf(data.value));
const sources = computed(() => (failure.value ? [] : ((data.value as { sources: SharedSourceView[] } | null)?.sources ?? [])));
</script>

<template>
  <div class="space-y-5">
    <ProjectFailure v-if="failure" :failure="failure" />

    <template v-else>
      <h1 class="text-xl font-semibold">Практики</h1>

      <UAlert
        v-if="sources.length === 0"
        color="neutral"
        variant="subtle"
        icon="i-lucide-book-open"
        title="Источники не названы"
        description="Впишите в манифест sources.shared — путь к другому DocDD-проекту и теги, по которым подключаются его decision и design. Без ключа приложение не догадывается, что показывать."
      />

      <div v-for="source in sources" :key="source.path" class="rounded border border-default p-4">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="font-medium">{{ source.label }}</h2>
          <span class="font-mono text-xs text-muted">{{ source.path }}</span>
        </div>

        <UAlert
          v-if="source.error"
          class="mt-3"
          color="error"
          variant="subtle"
          icon="i-lucide-triangle-alert"
          title="Источник не открылся"
          :description="source.error"
        />

        <template v-else>
          <UAlert
            v-if="source.narrowDomain.length"
            class="mt-3"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Похоже не на источник практик"
            :description="`В источнике есть записи типа ${source.narrowDomain.join(', ')} — decision и design всё равно подключены ниже, но остальное из источника не подтягивается никогда. Проверьте, тот ли это путь.`"
          />

          <p v-if="source.tags.length === 0" class="mt-3 text-sm text-muted">
            Источник назван, но теги не выбраны — ничего не подключено. Впишите теги рядом с
            путём в <code>sources.shared</code>.
          </p>
          <template v-else>
            <p class="mt-3 text-xs text-muted">
              Подключено по тегам: <span class="font-mono">{{ source.tags.join(', ') }}</span>
            </p>

            <p v-if="source.records.length === 0" class="mt-2 text-sm text-muted">
              По выбранным тегам в источнике ничего подтверждённого не нашлось.
            </p>
            <ul v-else class="mt-2 space-y-1">
              <li v-for="record in source.records" :key="record.id" class="flex flex-wrap items-center gap-2 text-sm">
                <UBadge variant="subtle">{{ typeLabel(record.type) }}</UBadge>
                <span class="font-mono text-xs text-muted">[{{ source.label }}] {{ record.id }}</span>
                <span>{{ record.title }}</span>
              </li>
            </ul>
          </template>
        </template>
      </div>
    </template>
  </div>
</template>
