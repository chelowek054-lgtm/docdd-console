<script setup lang="ts">
const route = useRoute();

/** Навигация появляется, только когда выбран проект: без него ей некуда вести. */
const projectId = computed(() => (typeof route.params['id'] === 'string' ? route.params['id'] : ''));

// Тот же ключ кэша, что у страниц: индекс не перечитывается лишний раз, счётчики
// в шапке и на самой вкладке всегда об одном и том же (docs/03-server-api.md).
const { records, index, errors, warnings } = useProjectIndex(projectId);

/** Неподтверждённых записей типа — черновик или на подтверждении: одна мера для всех документов. */
function unconfirmed(type: string): number {
  return records.value.filter((record) => record.type === type && ['draft', 'review'].includes(record.status)).length;
}

/** Открытых задач: не «закрыта» и не «отменена». */
const openTasks = computed(() => records.value.filter(
  (record) => record.type === 'task' && !['done', 'dropped'].includes(record.status)
).length);

/** Незакрытых фаз — по посчитанному статусу, а не по записанному в файле. */
const openPhases = computed(() => records.value.filter(
  (record) => record.type === 'phase' && phaseProgress(record, records.value).state !== 'done'
).length);

/** Проверок без пройденного прогона — не запускалась или последний прогон не `passed`. */
const openChecks = computed(() => {
  const results = index.value?.verificationResults ?? {};
  return records.value.filter(
    (record) => record.type === 'verification' && results[record.id]?.state !== 'passed'
  ).length;
});

const openIssues = computed(() => errors.value.length + warnings.value.length);

interface NavLink {
  label: string;
  to: string;
  count?: number;
}

type NavEntry = ({ kind: 'link' } & NavLink) | { kind: 'group'; label: string; links: NavLink[] };

/**
 * Шапка идёт по цепочке проекта — документ → работа → сверка
 * (docs/04-ui.md, «Навигация»), и у каждого типа записи из контракта есть
 * свой список, до которого из неё можно дойти. Раньше проектных документов,
 * решений, контрактов, фаз и записей карт в шапке не было вовсе — как раз
 * того, без подтверждения чего задача не уходит в работу.
 *
 * «Документы» — то, что человек подтверждает до кода: у всех четырёх одна
 * схема статусов. «Работа» — сам код. «Сверка» — всё, что отвечает на
 * «сходится ли»; Нарушения и Граф в ней рядом — список и картинка одного
 * состояния. Карты, Наполнение и Практики — после цепочки: не шаги, а опора.
 *
 * Прямая кнопка — там, где назначение одно: выпадающий список ради одного
 * пункта ничего не добавляет. Практики — не в «Наполнении»: Входящее и Импорт
 * заводят записи в этом проекте, а Практики только показывает чужие
 * decision/design (docs/11-shared-sources.md).
 */
const entries = computed<NavEntry[]>(() => {
  if (!projectId.value) return [];
  const base = `/projects/${projectId.value}`;
  return [
    { kind: 'link', label: 'Обзор', to: base },
    {
      kind: 'group',
      label: 'Документы',
      links: [
        { label: 'Требования', to: `${base}/requirements`, count: unconfirmed('requirement') },
        { label: 'Проектные документы', to: `${base}/documents?type=design`, count: unconfirmed('design') },
        { label: 'Решения', to: `${base}/documents?type=decision`, count: unconfirmed('decision') },
        { label: 'Контракты', to: `${base}/documents?type=contract`, count: unconfirmed('contract') }
      ]
    },
    {
      kind: 'group',
      label: 'Работа',
      links: [
        { label: 'Задачи', to: `${base}/tasks`, count: openTasks.value },
        { label: 'Фазы', to: `${base}/phases`, count: openPhases.value }
      ]
    },
    {
      kind: 'group',
      label: 'Сверка',
      links: [
        { label: 'Проверки', to: `${base}/checks`, count: openChecks.value },
        { label: 'Результат', to: `${base}/results` },
        { label: 'Нарушения', to: `${base}/issues`, count: openIssues.value },
        { label: 'Граф', to: `${base}/graph` }
      ]
    },
    { kind: 'link', label: 'Карты', to: `${base}/maps`, count: unconfirmed('map') },
    {
      kind: 'group',
      label: 'Наполнение',
      links: [
        { label: 'Входящее', to: `${base}/inbox` },
        { label: 'Импорт', to: `${base}/import` }
      ]
    },
    { kind: 'link', label: 'Практики', to: `${base}/shared` }
  ];
});

/** Подпись с числом рядом, если для пункта есть что считать (docs/04-ui.md). */
function withCount(link: NavLink): string {
  return link.count === undefined ? link.label : `${link.label} · ${link.count}`;
}

function menuItems(links: NavLink[]) {
  return links.map((link) => ({ label: withCount(link), to: link.to }));
}

/** Вкладка документов различается запросом, а подсветка — по пути экрана. */
function isActive(to: string): boolean {
  return to.split('?')[0] === route.path;
}
</script>

<template>
  <div class="min-h-screen bg-default text-default">
    <header class="border-b border-default">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-6 py-3">
        <NuxtLink to="/" class="font-semibold">DocDD Console</NuxtLink>

        <nav v-if="entries.length" class="flex flex-wrap items-center gap-1">
          <template v-for="entry in entries" :key="entry.label">
            <UButton
              v-if="entry.kind === 'link'"
              :to="entry.to"
              :variant="isActive(entry.to) ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
            >
              {{ withCount(entry) }}
            </UButton>

            <UDropdownMenu
              v-else
              :items="menuItems(entry.links)"
              :content="{ align: 'start' }"
            >
              <UButton
                :variant="entry.links.some((link) => isActive(link.to)) ? 'soft' : 'ghost'"
                color="neutral"
                size="sm"
                trailing-icon="i-lucide-chevron-down"
              >
                {{ entry.label }}
              </UButton>
            </UDropdownMenu>
          </template>
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
