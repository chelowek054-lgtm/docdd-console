<script setup lang="ts">
const route = useRoute();

/** Навигация появляется, только когда выбран проект: без него ей некуда вести. */
const projectId = computed(() => (typeof route.params['id'] === 'string' ? route.params['id'] : ''));

const links = computed(() => {
  if (!projectId.value) return [];
  const base = `/projects/${projectId.value}`;
  return [
    { label: 'Обзор', to: base },
    { label: 'Задачи', to: `${base}/tasks` },
    { label: 'Требования', to: `${base}/requirements` },
    { label: 'Нарушения', to: `${base}/issues` },
    { label: 'Граф', to: `${base}/graph` }
  ];
});
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <header class="border-b border-default">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
        <NuxtLink to="/" class="font-semibold">DocDD Console</NuxtLink>

        <nav v-if="links.length" class="flex flex-wrap items-center gap-1">
          <UButton
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            :variant="route.path === link.to ? 'soft' : 'ghost'"
            color="neutral"
            size="sm"
          >
            {{ link.label }}
          </UButton>
        </nav>

        <UButton
          v-if="projectId"
          to="/"
          variant="ghost"
          color="neutral"
          size="sm"
          class="ml-auto"
        >
          Все проекты
        </UButton>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-6">
      <slot />
    </main>
  </div>
</template>
