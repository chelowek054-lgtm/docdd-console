<script setup lang="ts">
const route = useRoute();

/** Навигация появляется, только когда выбран проект: без него ей некуда вести. */
const projectId = computed(() => (typeof route.params['id'] === 'string' ? route.params['id'] : ''));

/**
 * Вкладок много, и они не равны друг другу (docs/04-ui.md, «Навигация»):
 * «Работа» — что происходит с процессом сейчас, «Устройство» — как проект
 * устроен. Обзор — вне групп, он один и открывается прямой кнопкой.
 */
const groups = computed(() => {
  if (!projectId.value) return [];
  const base = `/projects/${projectId.value}`;
  return [
    {
      label: 'Работа',
      links: [
        { label: 'Задачи', to: `${base}/tasks` },
        { label: 'Требования', to: `${base}/requirements` },
        { label: 'Нарушения', to: `${base}/issues` },
        { label: 'Проверки', to: `${base}/checks` },
        { label: 'Результат', to: `${base}/results` }
      ]
    },
    {
      label: 'Устройство',
      links: [
        { label: 'Граф', to: `${base}/graph` },
        { label: 'Карты', to: `${base}/maps` },
        { label: 'Входящее', to: `${base}/inbox` },
        { label: 'Импорт', to: `${base}/import` }
      ]
    }
  ];
});

const overviewPath = computed(() => (projectId.value ? `/projects/${projectId.value}` : ''));

/** Кнопка группы подсвечена, если текущая страница — одна из вкладок внутри. */
function isActiveGroup(group: (typeof groups.value)[number]): boolean {
  return group.links.some((link) => link.to === route.path);
}
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <header class="border-b border-default">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
        <NuxtLink to="/" class="font-semibold">DocDD Console</NuxtLink>

        <nav v-if="overviewPath" class="flex flex-wrap items-center gap-1">
          <UButton
            :to="overviewPath"
            :variant="route.path === overviewPath ? 'soft' : 'ghost'"
            color="neutral"
            size="sm"
          >
            Обзор
          </UButton>

          <UDropdownMenu
            v-for="group in groups"
            :key="group.label"
            :items="group.links"
            :content="{ align: 'start' }"
          >
            <UButton
              :variant="isActiveGroup(group) ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
              trailing-icon="i-lucide-chevron-down"
            >
              {{ group.label }}
            </UButton>
          </UDropdownMenu>
        </nav>

        <div class="ml-auto flex items-center gap-1">
          <!-- Доступно всегда: инструкция нужна раньше, чем выбран проект. -->
          <UButton
            to="/usage"
            :variant="route.path === '/usage' ? 'soft' : 'ghost'"
            color="neutral"
            size="sm"
          >
            Как пользоваться
          </UButton>
          <UButton
            v-if="projectId"
            to="/"
            variant="ghost"
            color="neutral"
            size="sm"
          >
            Все проекты
          </UButton>
        </div>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-6">
      <slot />
    </main>
  </div>
</template>
