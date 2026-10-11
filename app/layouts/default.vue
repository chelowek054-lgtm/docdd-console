<script setup lang="ts">
import { designTokens } from '~/design-tokens';

const route = useRoute();
const { t, locale, setLocale, locales } = useT();

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
 * свой список, до которого из неё можно дойти. «Документы» — то, что человек
 * подтверждает до кода: у всех четырёх одна схема статусов. «Работа» — сам код.
 * «Сверка» — всё, что отвечает на «сходится ли». Карты, Наполнение, Практики и
 * Дизайн — после цепочки: не шаги, а опора.
 *
 * Подписи — ключи словаря (docs/16-design-system.md, «i18n»): в коде шапки ни
 * одной строки текста.
 */
const entries = computed<NavEntry[]>(() => {
  if (!projectId.value) return [];
  const base = `/projects/${projectId.value}`;
  return [
    { kind: 'link', label: t('nav.overview'), to: base },
    {
      kind: 'group',
      label: t('nav.documents'),
      links: [
        { label: t('nav.requirements'), to: `${base}/documents?type=requirement`, count: unconfirmed('requirement') },
        { label: t('nav.designDocs'), to: `${base}/documents?type=design`, count: unconfirmed('design') },
        { label: t('nav.decisions'), to: `${base}/documents?type=decision`, count: unconfirmed('decision') },
        { label: t('nav.contracts'), to: `${base}/documents?type=contract`, count: unconfirmed('contract') },
        { label: t('nav.reference'), to: `${base}/reference`, count: unconfirmed('reference') }
      ]
    },
    {
      kind: 'group',
      label: t('nav.work'),
      links: [
        { label: t('nav.tasks'), to: `${base}/work?tab=tasks`, count: openTasks.value },
        { label: t('nav.phases'), to: `${base}/work?tab=phases`, count: openPhases.value }
      ]
    },
    {
      kind: 'group',
      label: t('nav.verify'),
      links: [
        { label: t('nav.checks'), to: `${base}/verify?tab=checks`, count: openChecks.value },
        { label: t('nav.results'), to: `${base}/verify?tab=results` },
        { label: t('nav.issues'), to: `${base}/verify?tab=issues`, count: openIssues.value },
        { label: t('nav.graph'), to: `${base}/verify?tab=graph` }
      ]
    },
    { kind: 'link', label: t('nav.maps'), to: `${base}/maps`, count: unconfirmed('map') },
    {
      kind: 'group',
      label: t('nav.fill'),
      links: [
        { label: t('nav.inbox'), to: `${base}/fill?tab=inbox` },
        { label: t('nav.import'), to: `${base}/fill?tab=import` }
      ]
    },
    { kind: 'link', label: t('nav.practices'), to: `${base}/shared` },
    { kind: 'link', label: t('nav.design'), to: `${base}/design` }
  ];
});

/** Подпись с числом рядом, если для пункта есть что считать (docs/04-ui.md). */
function withCount(link: NavLink): string {
  return link.count === undefined ? link.label : `${link.label} · ${link.count}`;
}

function menuItems(links: NavLink[]) {
  return links.map((link) => ({ label: withCount(link), to: link.to }));
}

/**
 * Три положения, а не два: из «светлая/тёмная» к системной уже не вернуться
 * (docs/04-ui.md, «Тема»). Подписи свои — готовый переключатель Nuxt UI берёт
 * их из локали библиотеки, а она в приложении английская.
 */
const colorMode = useColorMode();

const THEMES = [
  { value: 'system', key: 'theme.system', icon: 'i-lucide-monitor' },
  { value: 'light', key: 'theme.light', icon: 'i-lucide-sun' },
  { value: 'dark', key: 'theme.dark', icon: 'i-lucide-moon' }
] as const;

/**
 * Темы сверх светлой и тёмной — из токенов консоли (`oled`, `contrast`…): тема
 * включается классом `theme-<имя>` на корне и базой (`dark` или нет), как
 * это делает выгрузка для проектов (docs/16-design-system.md). Выбор лежит в
 * cookie, чтобы сервер и клиент рисовали одну тему.
 */
const extraTheme = useCookie<string>('docdd-theme-extra', { default: () => '', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
const extraThemes = Object.entries(designTokens.themes as Record<string, { mode: string; label: string; labels?: Record<string, string> | null }>)
  .map(([name, theme]) => ({ name, mode: theme.mode, label: theme.label, labels: theme.labels ?? null }));

useHead({ htmlAttrs: { class: () => (extraTheme.value ? `theme-${extraTheme.value}` : '') } });

const currentTheme = computed(() => THEMES.find((theme) => theme.value === colorMode.preference) ?? THEMES[0]);

const themeItems = computed(() => [
  ...THEMES.map((theme) => ({
    label: t(theme.key),
    icon: theme.icon,
    type: 'checkbox' as const,
    checked: !extraTheme.value && colorMode.preference === theme.value,
    onSelect: () => {
      extraTheme.value = '';
      colorMode.preference = theme.value;
    }
  })),
  ...extraThemes.map((theme) => ({
    label: theme.labels?.[locale.value] ?? theme.label,
    icon: 'i-lucide-palette',
    type: 'checkbox' as const,
    checked: extraTheme.value === theme.name,
    onSelect: () => {
      extraTheme.value = theme.name;
      // База темы включает и `dark`, чтобы утилиты `dark:` и библиотека знали о тёмном фоне.
      colorMode.preference = theme.mode === 'dark' ? 'dark' : 'light';
    }
  }))
]);

/** Языки интерфейса — из токенов дизайна: сколько их там, столько и в меню. */
const localeItems = computed(() => locales.map((code) => ({
  label: t(`lang.${code}`),
  type: 'checkbox' as const,
  checked: locale.value === code,
  onSelect: () => { setLocale(code); }
})));

/** Вкладка документов различается запросом, а подсветка — по пути экрана. */
function isActive(to: string): boolean {
  return to.split('?')[0] === route.path;
}
</script>

<template>
  <div class="ds-page min-h-screen text-default">
    <header class="border-b border-default">
      <!-- Контейнер общей сетки: ширина по точкам перелома, поле — gutter токенов. -->
      <div class="ds-container flex flex-wrap items-center gap-4 py-3">
        <NuxtLink to="/" class="font-semibold">{{ t('app.name') }}</NuxtLink>

        <nav v-if="entries.length" class="flex flex-wrap items-center gap-1" :aria-label="t('app.name')">
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

        <div class="ml-auto flex shrink-0 items-center gap-1">
          <!-- Доступно всегда: инструкция нужна раньше, чем выбран проект. -->
          <ModelJobsBar />
          <UButton
            to="/usage"
            :variant="route.path === '/usage' ? 'soft' : 'ghost'"
            color="neutral"
            size="sm"
          >
            {{ t('nav.usage') }}
          </UButton>
          <!-- Глобальный экран токенов: на уровне консоли, поэтому доступен и без проекта. -->
          <UButton
            to="/design"
            :variant="route.path === '/design' ? 'soft' : 'ghost'"
            color="neutral"
            size="sm"
          >
            {{ t('nav.design') }}
          </UButton>
          <UButton
            v-if="projectId"
            to="/"
            variant="ghost"
            color="neutral"
            size="sm"
          >
            {{ t('nav.allProjects') }}
          </UButton>

          <UDropdownMenu :items="localeItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-languages"
              :aria-label="t('lang.aria', { name: t(`lang.${locale}`) })"
              variant="ghost"
              color="neutral"
              size="sm"
            >
              <span class="uppercase">{{ locale }}</span>
            </UButton>
          </UDropdownMenu>

          <!-- Выбор хранится в браузере: на сервере он неизвестен, поэтому
               кнопка рисуется только на клиенте — без мигания чужой темы. -->
          <ClientOnly>
            <UDropdownMenu :items="themeItems" :content="{ align: 'end' }">
              <UButton
                :icon="currentTheme.icon"
                :aria-label="t('theme.aria', { name: extraTheme ? extraTheme : t(currentTheme.key) })"
                variant="ghost"
                color="neutral"
                size="sm"
              />
            </UDropdownMenu>
            <template #fallback>
              <UButton icon="i-lucide-monitor" :aria-label="t('theme.fallbackAria')" variant="ghost" color="neutral" size="sm" disabled />
            </template>
          </ClientOnly>
        </div>
      </div>
    </header>

    <main class="ds-container py-6">
      <slot />
    </main>
  </div>
</template>
