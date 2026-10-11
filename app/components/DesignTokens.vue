<script setup lang="ts">
import {
  BORDER_NAMES,
  BREAKPOINT_NAMES,
  CONTAINER_NAMES,
  ICON_NAMES,
  MOTION_NAMES,
  DEFAULT_ROOT,
  PALETTE_ROLES,
  RADIUS_NAMES,
  REQUIRED_LOCALE,
  SPACING_NAMES,
  TYPOGRAPHY_NAMES,
  themeNames,
  themePalette,
  type ContrastRow,
  type DesignCheck,
  type DesignTokens
} from '~~/server/lib/design';

/**
 * Токены проекта после сложения «общее → локальное» (docs/04-ui.md, «Дизайн»):
 * палитра всех тем рядом с числами контраста, шкалы в натуральную величину в
 * rem, сетка, языки, принципы. У каждой части — откуда она. Образцы — свои
 * элементы со своим фоном, а не токены Nuxt UI: экран показывает именно
 * значения токенов.
 */
const props = defineProps<{
  tokens: DesignTokens;
  contrast: ContrastRow[];
  checks: DesignCheck[];
}>();

const root = computed(() => props.tokens.root?.value ?? DEFAULT_ROOT);

/** `0.9375rem · 15 px`: rem — единица токена, px — для того, кто привык думать пикселями. */
function remText(value: number): string {
  const px = Math.round(value * root.value * 100) / 100;
  return `${Number(value.toFixed(4))}rem · ${px} px`;
}

const themes = computed(() => themeNames(props.tokens));
const palettes = computed(() => Object.fromEntries(themes.value.map((name) => [name, themePalette(props.tokens, name)])));

const themeLabel = (name: string) => {
  if (name === 'light') return 'Светлая';
  if (name === 'dark') return 'Тёмная';
  return props.tokens.themes[name]?.label?.value ?? name;
};

const roles = computed(() => {
  const names = new Set<string>(PALETTE_ROLES);
  for (const theme of themes.value) for (const role of Object.keys(palettes.value[theme] ?? {})) names.add(role);
  return [...names];
});

/** Число контраста у роли, если она — текст в какой-то из проверяемых пар. */
function ratioFor(theme: string, role: string): ContrastRow[] {
  return props.contrast.filter((row) => row.theme === theme && row.pair[0] === role);
}

const lowKeys = computed(() => new Set(props.contrast.filter((row) => !row.ok).map((row) => `${row.theme}:${row.pair[0]}`)));

/** Читаемый цвет подписи на образце: белый или тёмный — по яркости фона. */
function labelColor(hex: string): string {
  const value = hex.slice(1, 7);
  const channel = (at: number) => parseInt(value.slice(at, at + 2), 16);
  const luma = 0.299 * channel(0) + 0.587 * channel(2) + 0.114 * channel(4);
  return luma > 150 ? '#141F1C' : '#FFFFFF';
}

function names(bag: Record<string, unknown>, required: readonly string[]): string[] {
  return [...required.filter((name) => name in bag), ...Object.keys(bag).filter((name) => !required.includes(name))];
}

const typographyNames = computed(() => names(props.tokens.typography, TYPOGRAPHY_NAMES));
const spacingNames = computed(() => names(props.tokens.spacing, SPACING_NAMES));
const radiusNames = computed(() => names(props.tokens.radius, RADIUS_NAMES));
const breakpointNames = computed(() => names(props.tokens.grid.breakpoints, BREAKPOINT_NAMES));
const containerNames = computed(() => names(props.tokens.grid.containers, CONTAINER_NAMES));
const borderNames = computed(() => names(props.tokens.border, BORDER_NAMES));
const iconNames = computed(() => names(props.tokens.icon, ICON_NAMES));
const motionNames = computed(() => names(props.tokens.motion, MOTION_NAMES));
const fontNames = computed(() => Object.keys(props.tokens.fonts));

const sourceLabel = (item: { source: string; level: string; overrides: string[] }) =>
  item.overrides.length ? `${item.source} (перекрыл ${item.overrides.join(', ')})` : item.source;

/** Демонстрация сетки: колонки и поле в rem, ширина — контейнер выбранной точки. */
const gridColumns = computed(() => props.tokens.grid.columns?.value ?? 12);
const gridGutter = computed(() => props.tokens.grid.gutter?.value ?? 1.5);
const locales = computed(() => props.tokens.i18n.locales.map((item) => item.value));
const i18nTrouble = computed(() => locales.value.length < 2 || !locales.value.includes(REQUIRED_LOCALE));
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <h2 class="font-medium">Палитра по ролям</h2>
      <p class="text-sm text-muted">
        Все темы рядом: светлая и тёмная — база, остальные — поверх неё. У текстовых ролей — контраст с их фоном;
        ниже 4.5:1 подсвечено.
      </p>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[34rem] text-left text-sm">
          <thead class="text-xs text-muted">
            <tr>
              <th class="pr-3">Роль</th>
              <th v-for="theme in themes" :key="theme" class="pr-3">
                {{ themeLabel(theme) }}
                <span v-if="tokens.themes[theme]" class="font-normal">· на базе {{ tokens.themes[theme]!.mode.value }}</span>
              </th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role" class="border-t border-default align-middle">
              <td class="py-1.5 pr-3 font-mono text-xs">{{ role }}</td>
              <td v-for="theme in themes" :key="theme" class="py-1.5 pr-3">
                <div v-if="palettes[theme]?.[role]" class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex h-9 w-24 items-center justify-center rounded border border-default font-mono text-xs"
                    :style="{ backgroundColor: palettes[theme]![role]!.value, color: labelColor(palettes[theme]![role]!.value) }"
                  >{{ palettes[theme]![role]!.value }}</span>
                  <span v-for="row in ratioFor(theme, role)" :key="row.pair.join('/')" class="text-xs" :class="row.ok ? 'text-muted' : 'font-semibold text-error'">
                    {{ row.ratio }}:1 на {{ row.pair[1] }}
                  </span>
                  <UBadge v-if="lowKeys.has(`${theme}:${role}`)" color="error" variant="subtle" size="sm">ниже 4.5:1</UBadge>
                </div>
                <span v-else class="text-xs text-warning">нет в этой теме</span>
              </td>
              <td class="py-1.5 text-xs text-muted">
                {{ sourceLabel(tokens.palette.light[role] ?? tokens.palette.dark[role] ?? { source: '—', level: '', overrides: [] }) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="contrast.length" class="space-y-3">
      <h2 class="font-medium">Пары «текст/фон»</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="theme in themes" :key="theme" class="space-y-2">
          <p class="text-xs text-muted">{{ themeLabel(theme) }}</p>
          <div
            v-for="row in contrast.filter((item) => item.theme === theme)"
            :key="row.pair.join('/')"
            class="flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm"
            :class="row.ok ? 'border-default' : 'border-error'"
            :style="{ backgroundColor: row.bg, color: row.fg }"
          >
            <span>{{ row.pair[0] }} на {{ row.pair[1] }}</span>
            <span class="font-mono text-xs">{{ row.ratio }}:1 {{ row.ok ? '' : '— ниже 4.5:1' }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-medium">Типографика</h2>
      <p class="text-sm text-muted">Размеры в rem: следуют за настройкой шрифта пользователя. Корень — {{ root }} px.</p>
      <div class="space-y-2">
        <div v-for="name in typographyNames" :key="name" class="flex flex-wrap items-baseline gap-x-4 border-t border-default pt-2">
          <span class="w-20 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span
            class="min-w-0"
            :style="{
              fontSize: `${tokens.typography[name]!.value.size}rem`,
              lineHeight: tokens.typography[name]!.value.line ? `${tokens.typography[name]!.value.line}rem` : undefined,
              fontWeight: tokens.typography[name]!.value.weight
            }"
          >Съешь ещё этих мягких булок</span>
          <span class="ml-auto text-xs text-muted">
            {{ remText(tokens.typography[name]!.value.size) }}<template v-if="tokens.typography[name]!.value.line"> / {{ tokens.typography[name]!.value.line }}rem</template>
            · {{ tokens.typography[name]!.value.weight ?? '—' }}
            · {{ sourceLabel(tokens.typography[name]!) }}
          </span>
        </div>
      </div>
    </section>

    <section class="grid gap-6 sm:grid-cols-2">
      <div class="space-y-2">
        <h2 class="font-medium">Отступы</h2>
        <div v-for="name in spacingNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="h-3 max-w-[50%] rounded-sm bg-primary" :style="{ width: `${tokens.spacing[name]!.value}rem` }" />
          <span class="ml-auto text-xs text-muted">{{ remText(tokens.spacing[name]!.value) }}</span>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="font-medium">Радиусы</h2>
        <div v-for="name in radiusNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span
            class="h-10 w-20 border border-default bg-elevated"
            :style="{ borderRadius: `${Math.min(tokens.radius[name]!.value, 1.25)}rem` }"
          />
          <span class="ml-auto text-xs text-muted">{{ remText(tokens.radius[name]!.value) }}</span>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-medium">Шрифты и строка</h2>
      <p v-if="!fontNames.length" class="text-sm text-warning">Шрифты не названы: нужен хотя бы `body`.</p>
      <div v-for="name in fontNames" :key="name" class="flex flex-wrap items-baseline gap-x-4 border-t border-default pt-2">
        <span class="w-16 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
        <span class="min-w-0" :style="{ fontFamily: tokens.fonts[name]!.value }">Съешь ещё этих мягких булок</span>
        <span class="ml-auto text-xs text-muted">{{ tokens.fonts[name]!.value }}</span>
      </div>
      <p v-if="fontNames.length > 3" class="text-sm text-warning">Семейств {{ fontNames.length }}: не больше трёх.</p>
      <p class="text-sm text-muted">
        Длина строки:
        <span v-if="tokens.measure">{{ tokens.measure.value }}ch · {{ tokens.measure.source }}</span>
        <span v-else class="text-warning">не задана</span>
      </p>
      <p
        v-if="tokens.measure"
        class="max-w-full overflow-hidden rounded bg-elevated p-2 text-sm"
        :style="{ maxWidth: `${tokens.measure.value}ch` }"
      >
        Образец строки заданной длины: чем длиннее строка, тем труднее глазу найти начало следующей, а короткая рвёт мысль.
      </p>
    </section>

    <section class="grid gap-6 sm:grid-cols-3">
      <div class="space-y-2">
        <h2 class="font-medium">Линии</h2>
        <div v-for="name in borderNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="block w-16 bg-primary" :style="{ height: `${tokens.border[name]!.value}rem` }" />
          <span class="ml-auto text-xs text-muted">{{ remText(tokens.border[name]!.value) }}</span>
        </div>
        <p v-if="!borderNames.length" class="text-sm text-warning">Толщины линий не заданы.</p>
      </div>
      <div class="space-y-2">
        <h2 class="font-medium">Значки</h2>
        <div v-for="name in iconNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="block rounded bg-primary/30" :style="{ width: `${tokens.icon[name]!.value}rem`, height: `${tokens.icon[name]!.value}rem` }" />
          <span class="ml-auto text-xs text-muted">{{ remText(tokens.icon[name]!.value) }}</span>
        </div>
        <p v-if="!iconNames.length" class="text-sm text-warning">Размеры значков не заданы.</p>
      </div>
      <div class="space-y-2">
        <h2 class="font-medium">Движение</h2>
        <div v-for="name in motionNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="text-xs">{{ tokens.motion[name]!.value }} мс</span>
          <span class="ml-auto text-xs text-muted">{{ tokens.motion[name]!.source }}</span>
        </div>
        <p v-if="!motionNames.length" class="text-sm text-warning">Длительности не заданы.</p>
        <p class="text-xs text-muted">При «уменьшить движение» в системе значения обнуляются в выгрузке.</p>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-medium">Сетка</h2>
      <p v-if="!tokens.grid.columns && !breakpointNames.length" class="text-sm text-warning">
        Сетка не задана: блок <code>grid</code> обязателен — 12 колонок, поле и точки перелома (docs/16-design-system.md).
      </p>
      <template v-else>
        <p class="text-sm text-muted">
          {{ gridColumns }} колонок · поле {{ remText(gridGutter) }} · от меньшей ширины к большей (<code>min-width</code>).
          <span v-if="tokens.grid.columns" class="text-xs">{{ sourceLabel(tokens.grid.columns) }}</span>
        </p>
        <div
          class="grid rounded border border-default bg-elevated p-2"
          :style="{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, gap: `${gridGutter}rem` }"
          aria-hidden="true"
        >
          <span v-for="count in gridColumns" :key="count" class="h-8 rounded-sm bg-primary/20" />
        </div>
        <div class="overflow-x-auto">
          <table class="w-full min-w-[24rem] text-left text-sm">
            <thead class="text-xs text-muted">
              <tr><th class="pr-3">Точка</th><th class="pr-3">От</th><th class="pr-3">Контейнер</th><th>Источник</th></tr>
            </thead>
            <tbody>
              <tr v-for="name in breakpointNames" :key="name" class="border-t border-default">
                <td class="py-1.5 pr-3 font-mono text-xs">{{ name }}</td>
                <td class="py-1.5 pr-3">{{ remText(tokens.grid.breakpoints[name]!.value) }}</td>
                <td class="py-1.5 pr-3">
                  <template v-if="containerNames.includes(name)">{{ remText(tokens.grid.containers[name]!.value) }}</template>
                  <span v-else class="text-muted">на всю ширину</span>
                </td>
                <td class="py-1.5 text-xs text-muted">{{ sourceLabel(tokens.grid.breakpoints[name]!) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <section class="space-y-2">
      <h2 class="font-medium">Языки (i18n)</h2>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <UBadge v-for="item in tokens.i18n.locales" :key="item.value" color="neutral" variant="subtle" size="sm">
          {{ item.value }}
          <template v-if="tokens.i18n.default?.value === item.value"> · основной</template>
          <template v-if="tokens.i18n.fallback?.value === item.value"> · запасной</template>
        </UBadge>
        <span v-if="!locales.length" class="text-warning">языки не названы</span>
        <span v-else-if="i18nTrouble" class="text-warning">нужно не меньше двух языков, среди них английский</span>
      </div>
      <p class="text-xs text-muted">В коде интерфейса — только ключи словаря: ни одной строки текста прямо в компоненте.</p>
    </section>

    <section v-if="tokens.principles.length" class="space-y-2">
      <h2 class="font-medium">Принципы</h2>
      <ul class="space-y-1 text-sm">
        <li v-for="item in tokens.principles" :key="item.value" class="flex flex-wrap gap-x-3">
          <span>{{ item.value }}</span>
          <span class="text-xs text-muted">{{ item.source }}</span>
        </li>
      </ul>
    </section>

    <section v-if="checks.length" class="space-y-2">
      <h2 class="font-medium">Находки</h2>
      <ul class="space-y-1 text-sm">
        <li v-for="(check, at) in checks" :key="at" class="flex gap-2">
          <code class="shrink-0 text-xs text-warning">{{ check.code }}</code>
          <span>{{ check.message }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
