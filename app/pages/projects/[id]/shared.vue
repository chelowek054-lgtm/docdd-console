<script setup lang="ts">
import type { ApiFailure } from '~/composables/useProjectIndex';
import type { SharedSourceView } from '~~/server/utils/shared-service';

/**
 * Практики: decision/design из других DocDD-проектов, читаемые для справки
 * (docs/11-shared-sources.md). Записи здесь не заводятся и не
 * подтверждаются — источник открывают своим отдельным проектом. Экран
 * меняет только то, какие теги подключены у уже названного источника —
 * список самих источников по-прежнему правится в манифесте руками.
 */
const route = useRoute();
const projectId = computed(() => String(route.params['id'] ?? ''));

const { data, refresh } = useFetch<{ sources: SharedSourceView[] } | { error: ApiFailure }>(
  () => `/api/projects/${projectId.value}/shared`,
  { key: () => `shared:${projectId.value}` }
);

const failure = computed(() => failureOf(data.value));
const sources = computed(() => (failure.value ? [] : ((data.value as { sources: SharedSourceView[] } | null)?.sources ?? [])));

/** Путь источника, у которого сейчас в процессе щёлкается галочка — против двойного клика. */
const pending = ref<string | null>(null);
const toggleFailure = ref<ApiFailure | null>(null);

async function toggleTag(source: SharedSourceView, tag: string) {
  const key = `${source.path}#${tag}`;
  pending.value = key;
  toggleFailure.value = null;
  try {
    const response = await $fetch<{ ok: true } | { error: ApiFailure }>(
      `/api/projects/${projectId.value}/shared`,
      {
        method: 'PATCH',
        body: { path: source.path, tag, enabled: !source.tags.includes(tag) },
        ignoreResponseError: true
      }
    );
    const problem = failureOf(response);
    if (problem) {
      toggleFailure.value = problem;
      return;
    }
    await refresh();
  } finally {
    if (pending.value === key) pending.value = null;
  }
}
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
        description="Впишите в манифест sources.shared — путь к другому DocDD-проекту. Без ключа приложение не догадывается, что показывать."
      />

      <UAlert
        v-if="toggleFailure"
        color="error"
        variant="subtle"
        icon="i-lucide-triangle-alert"
        :title="toggleFailure.message"
        :description="toggleFailure.detail"
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

          <p v-if="source.availableTags.length === 0" class="mt-3 text-sm text-muted">
            В источнике нет ни одного подтверждённого decision или design с тегом —
            подключать пока нечем.
          </p>
          <template v-else>
            <!-- Галочки — не список записей источника: тег может подключать
                 несколько decision/design разом, и один и тот же тег виден
                 сразу у всех записей, которые он охватывает. -->
            <p class="mt-3 text-xs text-muted">Подключить по тегам:</p>
            <div class="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              <label
                v-for="tag in source.availableTags"
                :key="tag"
                class="flex items-center gap-1.5 text-sm"
                :class="pending === `${source.path}#${tag}` ? 'opacity-50' : ''"
              >
                <UCheckbox
                  :model-value="source.tags.includes(tag)"
                  :disabled="pending === `${source.path}#${tag}`"
                  @update:model-value="toggleTag(source, tag)"
                />
                <span class="font-mono">{{ tag }}</span>
              </label>
            </div>

            <p v-if="source.tags.length === 0" class="mt-3 text-sm text-muted">
              Ничего не отмечено — ничего и не подключено: подключение выбором тегов, а не
              «взять всё» по умолчанию.
            </p>
            <template v-else>
              <p v-if="source.records.length === 0" class="mt-3 text-sm text-muted">
                По отмеченным тегам в источнике ничего подтверждённого не нашлось.
              </p>
              <template v-else>
                <ul class="mt-3 space-y-1">
                  <li v-for="record in source.records" :key="record.id" class="flex flex-wrap items-center gap-2 text-sm">
                    <UBadge variant="subtle">{{ typeLabel(record.type) }}</UBadge>
                    <NuxtLink
                      v-if="source.registeredProjectId"
                      :to="`/projects/${source.registeredProjectId}/records/${record.id}`"
                      class="font-mono text-xs text-muted hover:underline"
                    >[{{ source.label }}] {{ record.id }}</NuxtLink>
                    <span v-else class="font-mono text-xs text-muted">[{{ source.label }}] {{ record.id }}</span>
                    <span>{{ record.title }}</span>
                  </li>
                </ul>
                <p v-if="!source.registeredProjectId" class="mt-2 text-xs text-muted">
                  Источник не открыт в приложении своим проектом — прочитать запись целиком
                  можно, добавив <span class="font-mono">{{ source.path }}</span> на
                  <NuxtLink to="/" class="hover:underline">экране проектов</NuxtLink>.
                </p>
              </template>
            </template>
          </template>
        </template>
      </div>
    </template>
  </div>
</template>
