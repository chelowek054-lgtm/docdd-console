<script setup lang="ts">
import { designTokens } from '~/design-tokens';
// Явный импорт: окна шапки нужны на каждой странице, автоимпорт новых компонентов в dev их терял.
import GlobalSearch from '~/components/GlobalSearch.vue';
import SettingsDialog from '~/components/SettingsDialog.vue';

const route = useRoute();
const { t, locale, setLocale, locales } = useT();

/** Навигация появляется, только когда выбран проект: без него ей некуда вести. */
const projectId = computed(() => (typeof route.params['id'] === 'string' ? route.params['id'] : ''));

// Тот же ключ кэша, что у страниц: индекс не перечитывается лишний раз, счётчики
// в шапке и на самой вкладке всегда об одном и том же (docs/03-server-api.md).
const indexModes = { light: useState<boolean>('index-light', () => false), tasks: useState<boolean>('index-tasks', () => false), lazy: useState<boolean>('index-lazy', () => false) }; watchEffect(() => { indexModes.light.value = /\/(maps|records\/[^/]+)$/.test(route.path); indexModes.tasks.value = /\/work$/.test(route.path) && route.query['tab'] !== 'phases'; indexModes.lazy.value = /\/(maps|records\/[^/]+)$/.test(route.path); }); /* список задач — лёгкий индекс (light=2); на картах индекс второстепенный и не встраивается в HTML */ const { records, index, errors, warnings } = useProjectIndex(projectId); // лёгкий индекс — только на тяжёлых страницах; режим общий через useState

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
  key: NavKey;
  label: string;
  to: string;
  count?: number;
}

type NavEntry = ({ kind: 'link' } & NavLink) | { kind: 'group'; label: string; links: NavLink[] };

/**
 * Глобальная роль шапки (docs/04-ui.md, «Переключатель роли»): вид, а не право.
 * Хранится в cookie, чтобы сервер и клиент рисовали одну шапку. Если вход включён
 * и у человека в проекте одна роль, она выбрана, пока он не выбрал другую.
 */
const roleCookie = useCookie<string>('docdd-role', { default: () => '', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' });
const { me } = useMe(projectId);
const role = computed<NavRoleChoice>(() => {
  if (isNavRole(roleCookie.value)) return roleCookie.value;
  if (roleCookie.value === 'all') return '';
  const mine = (me.value.roles ?? []).filter(isNavRole);
  return mine.length === 1 ? mine[0]! : '';
});
const roleItems = computed(() => [
  { value: '', label: t('role.all') },
  ...NAV_ROLES.map((value) => ({ value, label: t(`role.${value}`) }))
].map((item) => ({
  label: item.label,
  type: 'checkbox' as const,
  checked: role.value === item.value,
  onSelect: () => { roleCookie.value = item.value || 'all'; }
})));
const roleLabel = computed(() => (role.value ? t(`role.${role.value}`) : t('role.all')));

/**
 * Шапка идёт по цепочке проекта — документ → работа → сверка, затем опора:
 * карты, наполнение, инструменты (docs/04-ui.md, «Навигация»). Пункт, не нужный
 * выбранной роли, не показывается; группа без пунктов — тоже.
 */
const allEntries = computed<NavEntry[]>(() => {
  if (!projectId.value) return [];
  const base = `/projects/${projectId.value}`;
  return [
    { kind: 'link', key: 'overview', label: t('nav.overview'), to: base },
    {
      kind: 'group',
      label: t('nav.documents'),
      links: [
        { key: 'requirements', label: t('nav.requirements'), to: `${base}/documents?type=requirement`, count: unconfirmed('requirement') },
        { key: 'designDocs', label: t('nav.designDocs'), to: `${base}/documents?type=design`, count: unconfirmed('design') },
        { key: 'decisions', label: t('nav.decisions'), to: `${base}/documents?type=decision`, count: unconfirmed('decision') },
        { key: 'contracts', label: t('nav.contracts'), to: `${base}/documents?type=contract`, count: unconfirmed('contract') },
        { key: 'reference', label: t('nav.reference'), to: `${base}/reference`, count: unconfirmed('reference') },
        { key: 'knowledge', label: t('nav.knowledge'), to: `${base}/knowledge` },
        { key: 'glossary', label: t('nav.glossary'), to: `${base}/glossary` }
      ]
    },
    {
      kind: 'group',
      label: t('nav.work'),
      links: [
        { key: 'tasks', label: t('nav.tasks'), to: `${base}/work?tab=tasks`, count: openTasks.value },
        { key: 'phases', label: t('nav.phases'), to: `${base}/work?tab=phases`, count: openPhases.value },
        { key: 'manager', label: t('nav.manager'), to: `${base}/manager` },
        { key: 'releases', label: t('nav.releases'), to: `${base}/releases` }
      ]
    },
    {
      kind: 'group',
      label: t('nav.verify'),
      links: [
        { key: 'checks', label: t('nav.checks'), to: `${base}/verify?tab=checks`, count: openChecks.value },
        { key: 'results', label: t('nav.results'), to: `${base}/verify?tab=results` },
        { key: 'issues', label: t('nav.issues'), to: `${base}/verify?tab=issues`, count: openIssues.value },
        { key: 'graph', label: t('nav.graph'), to: `${base}/verify?tab=graph` }
      ]
    },
    { kind: 'link', key: 'maps', label: t('nav.maps'), to: `${base}/maps`, count: unconfirmed('map') },
    {
      kind: 'group',
      label: t('nav.fill'),
      links: [
        { key: 'inbox', label: t('nav.inbox'), to: `${base}/fill?tab=inbox` },
        { key: 'import', label: t('nav.import'), to: `${base}/fill?tab=import` }
      ]
    },
    {
      kind: 'group',
      label: t('nav.tools'),
      links: [
        { key: 'design', label: t('nav.design'), to: `${base}/design` },
        { key: 'analyst', label: t('nav.analyst'), to: `${base}/analyst` },
        { key: 'practices', label: t('nav.practices'), to: `${base}/shared` }
      ]
    }
  ];
});

const entries = computed<NavEntry[]>(() => allEntries.value.flatMap((entry): NavEntry[] => {
  if (entry.kind === 'link') return navVisible(entry.key, role.value) ? [entry] : [];
  const links = entry.links.filter((link) => navVisible(link.key, role.value));
  return links.length ? [{ ...entry, links }] : [];
}));

/**
 * Пункты меню для глобального поиска — если человек потерялся (docs/04-ui.md, «Поиск»):
 * видимые роли пункты проекта и общие экраны консоли.
 */
const searchLinks = computed(() => [
  ...entries.value.flatMap((entry) => (entry.kind === 'link'
    ? [{ label: entry.label, group: '', to: entry.to, hints: NAV_HINTS[entry.key] }]
    : entry.links.map((link) => ({ label: link.label, group: entry.label, to: link.to, hints: NAV_HINTS[link.key] })))),
  { label: t('nav.portfolio'), group: '', to: '/portfolio', hints: 'портфель все проекты portfolio' },
  { label: t('nav.usage'), group: '', to: '/usage', hints: 'как пользоваться помощь инструкция справка help' },
  { label: t('nav.allProjects'), group: '', to: '/', hints: 'проекты список выбрать проект projects' }
]);

/** Все пункты одним меню — для узкой ширины, где группы не помещаются в строку. */
const compactItems = computed(() => entries.value.map((entry) => (entry.kind === 'link'
  ? [{ label: withCount(entry), to: entry.to }]
  : [{ label: entry.label, type: 'label' as const }, ...menuItems(entry.links)])));

/** Подпись с числом рядом, только если есть что считать: «· 0» лишь занимает строку. */
function withCount(link: NavLink): string {
  return link.count ? `${link.label} · ${link.count}` : link.label;
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

/** Пункт группы активен, если совпали путь и его параметры запроса; без параметра в адресе — первый пункт этого пути. */
function linkActive(to: string, links: NavLink[]): boolean {
  const [path, query = ''] = to.split('?');
  if (path !== route.path) return false;
  const params = new URLSearchParams(query);
  for (const [name, value] of params) {
    const current = route.query[name];
    if (current === undefined || current === null || current === '') {
      return links.find((link) => link.to.split('?')[0] === path)?.to === to;
    }
    if (current !== value) return false;
  }
  return true;
}

/** Группа, в которой открыт экран: её пункты — строкой вкладок под шапкой. */
const activeGroup = computed(() => entries.value.find((entry): entry is Extract<NavEntry, { kind: 'group' }> =>
  entry.kind === 'group' && entry.links.some((link) => link.to.split('?')[0] === route.path)) ?? null);

/** Вкладка документов различается запросом, а подсветка — по пути экрана. */
function isActive(to: string): boolean {
  return to.split('?')[0] === route.path;
}
</script>

<template>
  <div class="ds-page min-h-screen text-default">
    <header class="border-b border-default">
      <!-- Одна строка (docs/04-ui.md, «Шапка — одна строка»): группы не переносятся;
           уже не помещаются — сворачиваются в «Меню». -->
      <div class="ds-container flex flex-nowrap items-center gap-2 py-2">
        <NuxtLink to="/" class="shrink-0 font-semibold whitespace-nowrap">{{ t('app.name') }}</NuxtLink>

        <UDropdownMenu v-if="entries.length" :items="compactItems" :content="{ align: 'start' }" class="lg:hidden">
          <UButton icon="i-lucide-menu" variant="ghost" color="neutral" size="sm" class="lg:hidden">{{ t('nav.menu') }}</UButton>
        </UDropdownMenu>

        <nav v-if="entries.length" class="hidden min-w-0 flex-nowrap items-center gap-0.5 lg:flex" :aria-label="t('app.name')">
          <template v-for="entry in entries" :key="entry.label">
            <UButton
              v-if="entry.kind === 'link'"
              :to="entry.to"
              :variant="isActive(entry.to) ? 'soft' : 'ghost'"
              color="neutral"
              size="sm"
              class="whitespace-nowrap"
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
                class="whitespace-nowrap"
              >
                {{ entry.label }}
              </UButton>
            </UDropdownMenu>
          </template>
        </nav>

        <div class="ml-auto flex shrink-0 flex-nowrap items-center gap-0.5">
          <!-- Роль — только когда есть проект: она сужает его навигацию. -->
          <UDropdownMenu v-if="projectId" :items="roleItems" :content="{ align: 'end' }">
            <UButton
              icon="i-lucide-user-round-cog"
              :aria-label="t('role.aria', { name: roleLabel })"
              variant="soft"
              color="neutral"
              size="sm"
              class="max-w-40 whitespace-nowrap"
            >
              <span class="hidden truncate xl:inline">{{ roleLabel }}</span>
            </UButton>
          </UDropdownMenu>
          <GlobalSearch v-if="projectId" :project-id="projectId" :links="searchLinks" /><NotificationsBell /><ModelJobsBar />
          <span v-if="projectId" class="mx-1 h-5 w-px bg-(--ui-border)" aria-hidden="true" /><!-- поиск и события | общие экраны | вид и настройки -->

          <!-- Без проекта: общие экраны консоли. С проектом к ним ведёт логотип — список проектов. -->
          <template v-if="!projectId">
            <UButton to="/portfolio" :variant="route.path === '/portfolio' ? 'soft' : 'ghost'" color="neutral" size="sm" class="whitespace-nowrap">{{ t('nav.portfolio') }}</UButton>
            <UButton to="/usage" :variant="route.path === '/usage' ? 'soft' : 'ghost'" color="neutral" size="sm" class="whitespace-nowrap">{{ t('nav.usage') }}</UButton>
            <UButton to="/design" :variant="route.path === '/design' ? 'soft' : 'ghost'" color="neutral" size="sm" class="whitespace-nowrap">{{ t('nav.design') }}</UButton>
            <UButton v-if="route.path !== '/'" to="/" variant="ghost" color="neutral" size="sm" class="whitespace-nowrap">{{ t('nav.allProjects') }}</UButton>
          </template>

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
          </ClientOnly><SettingsDialog :project-id="projectId" />
        </div>
      </div>
    </header>

    <!-- Вкладки группы: те же пункты, что в её меню, с учётом роли — у каждой группы одна строка. -->
    <!-- Строка есть на каждом экране проекта, даже без вкладок: высота шапки не меняется, страница не прыгает. -->
    <nav v-if="projectId" class="border-b border-default" :aria-label="activeGroup?.label ?? t('app.name')">
      <div class="ds-container flex min-h-11 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <UButton
          v-for="link in activeGroup?.links ?? []"
          :key="link.to"
          :to="link.to"
          :variant="linkActive(link.to, activeGroup?.links ?? []) ? 'soft' : 'ghost'"
          :color="linkActive(link.to, activeGroup?.links ?? []) ? 'primary' : 'neutral'"
          size="sm"
          class="shrink-0 whitespace-nowrap"
        >
          {{ withCount(link) }}
        </UButton>
      </div>
    </nav>

    <main class="ds-container py-6">
      <slot />
    </main>
  </div>
</template>
