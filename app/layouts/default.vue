<script setup lang="ts">
const route = useRoute();

/** Навигация появляется, только когда выбран проект: без него ей некуда вести. */
const projectId = computed(() => (typeof route.params['id'] === 'string' ? route.params['id'] : ''));

// Тот же ключ кэша, что у страниц: индекс не перечитывается лишний раз, счётчики
// в шапке и на самой вкладке всегда об одном и том же (docs/03-server-api.md).
const { records, index, errors, warnings } = useProjectIndex(projectId);

/** Открытых задач: не «закрыта» и не «отменена». */
const openTasks = computed(() => records.value.filter(
  (record) => record.type === 'task' && !['done', 'dropped'].includes(record.status)
).length);

/** Неподтверждённых требований: черновик или на подтверждении. */
const openRequirements = computed(() => records.value.filter(
  (record) => record.type === 'requirement' && ['draft', 'review'].includes(record.status)
).length);

/** Проверок без пройденного прогона — не запускалась или последний прогон не `passed`. */
const openChecks = computed(() => {
  const results = index.value?.verificationResults ?? {};
  return records.value.filter(
    (record) => record.type === 'verification' && results[record.id]?.state !== 'passed'
  ).length;
});

const openIssues = computed(() => errors.value.length + warnings.value.length);

/**
 * Вкладок много, и они не равны друг другу (docs/04-ui.md, «Навигация»):
 * «Работа» — что происходит с процессом сейчас, «Наполнение» — как в проект
 * попадают новые записи. Обзор, Карты и Практики — вне групп: у каждой ровно
 * одна прямая кнопка не нуждается в выпадающем списке ради самой себя.
 *
 * Практики — не в «Наполнении», хотя это тоже взгляд наружу: Входящее и
 * Импорт заводят записи в этом проекте, а Практики ничего не заводит — это
 * чужие decision/design, показанные для чтения (docs/11-shared-sources.md).
 * Разное действие — разное место, не общая тема «внешнее».
 *
 * Внутри «Работы» вкладки идут в порядке заполнения: сперва требование,
 * потом задача, которая его выполняет, потом проверка и её результат.
 * «Нарушения» и «Граф» — не шаги заполнения, а два взгляда на состояние
 * процесса разом (список и картинка того же самого — что не связано, что
 * забыто), поэтому стоят последними, не в середине цепочки.
 *
 * Граф записей — не то же самое, что Карты: Граф про требования, задачи и
 * связи между ними (процесс), Карты — про модули, потоки данных,
 * пользовательские пути (устройство кода). Оба рисуют узлы и рёбра, но не
 * про одно и то же — раньше Граф лежал рядом с Картами именно по внешнему
 * сходству, а не по смыслу, и это было ошибкой.
 */
const groups = computed(() => {
  if (!projectId.value) return [];
  const base = `/projects/${projectId.value}`;
  return [
    {
      label: 'Работа',
      links: [
        { label: 'Требования', to: `${base}/requirements`, count: openRequirements.value },
        { label: 'Задачи', to: `${base}/tasks`, count: openTasks.value },
        { label: 'Проверки', to: `${base}/checks`, count: openChecks.value },
        { label: 'Результат', to: `${base}/results` },
        { label: 'Нарушения', to: `${base}/issues`, count: openIssues.value },
        { label: 'Граф', to: `${base}/graph` }
      ]
    },
    {
      label: 'Наполнение',
      links: [
        { label: 'Входящее', to: `${base}/inbox` },
        { label: 'Импорт', to: `${base}/import` }
      ]
    }
  ];
});

/** Пункт меню с числом рядом, если для вкладки есть что считать (docs/04-ui.md). */
function menuItems(group: (typeof groups.value)[number]) {
  return group.links.map((link) => ({
    label: 'count' in link ? `${link.label} · ${link.count}` : link.label,
    to: link.to
  }));
}

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
          <UButton
            :to="`${overviewPath}/maps`"
            :variant="route.path === `${overviewPath}/maps` ? 'soft' : 'ghost'"
            color="neutral"
            size="sm"
          >
            Карты
          </UButton>
          <UButton
            :to="`${overviewPath}/shared`"
            :variant="route.path === `${overviewPath}/shared` ? 'soft' : 'ghost'"
            color="neutral"
            size="sm"
          >
            Практики
          </UButton>

          <UDropdownMenu
            v-for="group in groups"
            :key="group.label"
            :items="menuItems(group)"
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
