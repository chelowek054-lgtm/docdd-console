<script setup lang="ts">
import {
  BORDER_NAMES,
  BREAKPOINT_NAMES,
  CONTAINER_NAMES,
  DEFAULT_ROOT,
  ICON_NAMES,
  MOTION_NAMES,
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
import { backdropValue, elevationValue, parseSurface } from '~~/server/lib/design-surface';

/**
 * Токены проекта после сложения «общее → локальное» (docs/04-ui.md, «Дизайн»):
 * палитра всех тем рядом с числами контраста, шкалы в натуральную величину в
 * rem, сетка, языки, принципы, версия и список изменений. У каждой части —
 * откуда она. Образцы — свои элементы со своим фоном, а не токены Nuxt UI:
 * экран показывает именно значения токенов. В режиме разработчика рядом —
 * имена переменных выгрузки.
 */
const props = defineProps<{
  tokens: DesignTokens;
  contrast: ContrastRow[];
  checks: DesignCheck[];
  developer?: boolean;
}>();

const { t, locale } = useT();

const root = computed(() => props.tokens.root?.value ?? DEFAULT_ROOT);

/** `0.9375rem · 15 px`: rem — единица токена, px — для того, кто привык думать пикселями. */
function remText(value: number): string {
  const px = Math.round(value * root.value * 100) / 100;
  return `${Number(value.toFixed(4))}rem · ${px} px`;
}

const themes = computed(() => themeNames(props.tokens));
const palettes = computed(() => Object.fromEntries(themes.value.map((name) => [name, themePalette(props.tokens, name)])));

const themeLabel = (name: string) => {
  if (name === 'light') return t('dt.theme.light');
  if (name === 'dark') return t('dt.theme.dark');
  const theme = props.tokens.themes[name];
  // Название по языку интерфейса, затем общая строка, затем имя: пустого места не бывает.
  return theme?.labels?.value[locale.value] ?? theme?.label?.value ?? name;
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

/** Тени, подложка, мягкая заливка и подписи капсом: приходят «незнакомыми» ключами блока (docs/16-design-system.md, «Поверхности и вид»). */
const surface = computed(() => parseSurface(Object.fromEntries(Object.entries(props.tokens.extra).map(([key, item]) => [key, item.value]))).surface);
const surfaceSource = (key: string) => props.tokens.extra[key]?.source ?? '';
const surfaceEmpty = computed(() => ['elevation', 'backdrop', 'tint', 'caps'].every((key) => Object.keys(surface.value[key as 'elevation']).length === 0));
const SOFT_ROLES = ['accent', 'core', 'info', 'warn', 'danger'] as const;
const soft = (role: string, share: number) => `color-mix(in srgb, var(--ds-color-${kebab(role)}) ${share * 100}%, var(--ds-color-surface))`;

const kebab = (value: string) => value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const sourceLabel = (item: { source: string; level: string; overrides: string[] }) =>
  item.overrides.length ? `${item.source} (${t('dt.overrode', { list: item.overrides.join(', ') })})` : item.source;

/** Демонстрация сетки: колонки и поле в rem. */
const gridColumns = computed(() => props.tokens.grid.columns?.value ?? 12);
const gridGutter = computed(() => props.tokens.grid.gutter?.value ?? 1.5);
const locales = computed(() => props.tokens.i18n.locales.map((item) => item.value));
const i18nTrouble = computed(() => locales.value.length < 2 || !locales.value.includes(REQUIRED_LOCALE));
</script>

<template>
  <div class="space-y-8">
    <section v-if="tokens.version" class="space-y-2">
      <div class="flex flex-wrap items-center gap-3">
        <h2 class="font-medium">{{ t('dt.version') }}</h2>
        <UBadge color="primary" variant="subtle">v{{ tokens.version.value }}</UBadge>
        <span class="text-xs text-muted">{{ tokens.version.source }}</span>
      </div>
      <details v-if="tokens.changes.length">
        <summary class="cursor-pointer text-sm">{{ t('dt.changes.title') }}</summary>
        <ul class="mt-2 space-y-1 text-sm">
          <li v-for="change in tokens.changes" :key="`${change.value.version}:${change.value.summary}`" class="flex flex-wrap gap-x-3">
            <span class="font-mono text-xs">v{{ change.value.version }}</span>
            <span v-if="change.value.date" class="text-xs text-muted">{{ change.value.date }}</span>
            <span>{{ change.value.summary }}</span>
          </li>
        </ul>
      </details>
    </section>

    <section class="space-y-3">
      <h2 class="font-medium">{{ t('dt.palette.title') }}</h2>
      <p class="text-sm text-muted">{{ t('dt.palette.lead') }}</p>
      <div class="overflow-x-auto">
        <table class="ds-table w-full min-w-[34rem] text-left text-sm">
          <thead class="text-xs text-muted">
            <tr>
              <th class="pr-3">{{ t('dt.col.role') }}</th>
              <th v-for="theme in themes" :key="theme" class="pr-3">
                {{ themeLabel(theme) }}
                <span v-if="tokens.themes[theme]" class="font-normal">· {{ t('dt.baseOn', { mode: tokens.themes[theme]!.mode.value }) }}</span>
              </th>
              <th>{{ t('dt.col.source') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role" class="border-t border-default align-middle">
              <td class="py-1.5 pr-3 font-mono text-xs">
                {{ role }}
                <span v-if="developer" class="block text-muted">--ds-color-{{ kebab(role) }}</span>
              </td>
              <td v-for="theme in themes" :key="theme" class="py-1.5 pr-3">
                <div v-if="palettes[theme]?.[role]" class="flex flex-wrap items-center gap-2">
                  <span
                    class="inline-flex h-9 w-24 items-center justify-center rounded border border-default font-mono text-xs"
                    :style="{ backgroundColor: palettes[theme]![role]!.value, color: labelColor(palettes[theme]![role]!.value) }"
                  >{{ palettes[theme]![role]!.value }}</span>
                  <span v-for="row in ratioFor(theme, role)" :key="row.pair.join('/')" class="text-xs" :class="row.ok ? 'text-muted' : 'font-semibold text-error'">
                    {{ row.ratio }}:1 / {{ row.pair[1] }}
                  </span>
                  <UBadge v-if="lowKeys.has(`${theme}:${role}`)" color="error" variant="subtle" size="sm">{{ t('dt.below') }}</UBadge>
                </div>
                <span v-else class="text-xs text-warning">{{ t('dt.absent') }}</span>
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
      <h2 class="font-medium">{{ t('dt.pairs.title') }}</h2>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div v-for="theme in themes" :key="theme" class="space-y-2">
          <p class="text-xs text-muted">{{ themeLabel(theme) }}</p>
          <div
            v-for="row in contrast.filter((item) => item.theme === theme)"
            :key="row.pair.join('/')"
            class="flex items-center justify-between gap-3 ds-card ds-card--bordered px-3 py-2 text-sm"
            :class="row.ok ? 'border-default' : 'border-error'"
            :style="{ backgroundColor: row.bg, color: row.fg }"
          >
            <span>{{ t('dt.pair', { fg: row.pair[0], bg: row.pair[1] }) }}</span>
            <span class="font-mono text-xs">{{ row.ratio }}:1 <template v-if="!row.ok">— {{ t('dt.belowMin', { min: row.min }) }}</template></span>
          </div>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-medium">{{ t('dt.typography.title') }}</h2>
      <p class="text-sm text-muted">{{ t('dt.typography.lead', { root }) }}</p>
      <div class="space-y-2">
        <div v-for="name in typographyNames" :key="name" class="flex flex-wrap items-baseline gap-x-4 border-t border-default pt-2">
          <span class="w-20 shrink-0 font-mono text-xs text-muted">
            {{ name }}
            <span v-if="developer" class="block">--ds-font-{{ kebab(name) }}</span>
          </span>
          <span
            class="min-w-0"
            :style="{
              fontSize: `${tokens.typography[name]!.value.size}rem`,
              lineHeight: tokens.typography[name]!.value.line ? `${tokens.typography[name]!.value.line}rem` : undefined,
              fontWeight: tokens.typography[name]!.value.weight
            }"
          >{{ t('dt.sample') }}</span>
          <span class="ml-auto text-xs text-muted">
            {{ remText(tokens.typography[name]!.value.size) }}<template v-if="tokens.typography[name]!.value.line"> / {{ tokens.typography[name]!.value.line }}rem</template>
            · {{ tokens.typography[name]!.value.weight ?? '—' }}
            · {{ sourceLabel(tokens.typography[name]!) }}
          </span>
        </div>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-medium">{{ t('dt.fonts.title') }}</h2>
      <p v-if="!fontNames.length" class="text-sm text-warning">{{ t('dt.fonts.none') }}</p>
      <div v-for="name in fontNames" :key="name" class="flex flex-wrap items-baseline gap-x-4 border-t border-default pt-2">
        <span class="w-16 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
        <span class="min-w-0" :style="{ fontFamily: tokens.fonts[name]!.value }">{{ t('dt.sample') }}</span>
        <span class="ml-auto text-xs text-muted">{{ tokens.fonts[name]!.value }}</span>
      </div>
      <p v-if="fontNames.length > 3" class="text-sm text-warning">{{ t('dt.fonts.many', { count: fontNames.length }) }}</p>
      <p class="text-sm text-muted">
        {{ t('dt.measure') }}:
        <span v-if="tokens.measure">{{ tokens.measure.value }}ch · {{ tokens.measure.source }}</span>
        <span v-else class="text-warning">{{ t('dt.measure.none') }}</span>
      </p>
      <p
        v-if="tokens.measure"
        class="max-w-full overflow-hidden rounded bg-elevated p-2 text-sm"
        :style="{ maxWidth: `${tokens.measure.value}ch` }"
      >
        {{ t('dt.measure.sample') }}
      </p>
    </section>

    <section class="grid gap-6 sm:grid-cols-2">
      <div class="space-y-2">
        <h2 class="font-medium">{{ t('dt.spacing.title') }}</h2>
        <div v-for="name in spacingNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="h-3 max-w-[50%] rounded-sm bg-primary" :style="{ width: `${tokens.spacing[name]!.value}rem` }" />
          <span class="ml-auto text-xs text-muted">{{ remText(tokens.spacing[name]!.value) }}</span>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="font-medium">{{ t('dt.radius.title') }}</h2>
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
      <h2 class="font-medium">{{ t('dt.surface.title') }}</h2>
      <p v-if="surfaceEmpty" class="text-sm text-warning">{{ t('dt.surface.none') }}</p>
      <div v-else class="grid gap-6 sm:grid-cols-2">
        <div v-for="name in Object.keys(surface.elevation)" :key="'e' + name" class="space-y-2">
          <p class="text-sm font-medium">{{ t('dt.surface.elevation') }} <code>{{ name }}</code> <span class="text-xs font-normal text-muted">{{ surfaceSource('elevation') }}</span></p>
          <div class="h-20 rounded-(--ds-radius-lg) bg-elevated p-3 text-xs text-muted" :style="{ boxShadow: elevationValue(surface.elevation[name]!) }">
            <p v-for="(layer, at) in surface.elevation[name]" :key="at">{{ layer.x }} {{ layer.y }} {{ layer.blur }} {{ layer.spread }} rem · {{ Math.round(layer.alpha * 100) }} %</p>
          </div>
        </div>
        <div v-for="name in Object.keys(surface.backdrop)" :key="'b' + name" class="space-y-2">
          <p class="text-sm font-medium">{{ t('dt.surface.backdrop') }} <code>{{ name }}</code> <span class="text-xs font-normal text-muted">{{ surfaceSource('backdrop') }}</span></p>
          <div class="h-20 rounded-(--ds-radius-lg) border border-default" :style="{ backgroundColor: 'var(--ds-color-bg)', backgroundImage: backdropValue(surface.backdrop[name]!) }" />
          <p class="text-xs text-muted">
            <span v-for="(glow, at) in surface.backdrop[name]" :key="at" class="mr-3">{{ glow.color }} {{ Math.round(glow.alpha * 100) }} % · {{ glow.x }}/{{ glow.y }} %</span>
          </p>
        </div>
        <div v-for="name in Object.keys(surface.tint)" :key="'t' + name" class="space-y-2">
          <p class="text-sm font-medium">{{ t('dt.surface.tint') }} <code>{{ name }}</code> <span class="text-xs font-normal text-muted">{{ Math.round(surface.tint[name]! * 100) }} % · {{ surfaceSource('tint') }}</span></p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="role in SOFT_ROLES"
              :key="role"
              class="rounded-full px-3 py-1 text-xs font-semibold"
              :style="{ backgroundColor: soft(role, surface.tint[name]!), color: `var(--ds-color-${role === 'accent' ? 'accent-text' : kebab(role)})` }"
            >{{ role }}</span>
          </div>
        </div>
        <div v-for="name in Object.keys(surface.caps)" :key="'c' + name" class="space-y-2">
          <p class="text-sm font-medium">{{ t('dt.surface.caps') }} <code>{{ name }}</code> <span class="text-xs font-normal text-muted">{{ surface.caps[name] }} em · {{ surfaceSource('caps') }}</span></p>
          <p :class="'ds-' + kebab(name)" class="text-muted">{{ t('dt.surface.capsSample') }}</p>
        </div>
      </div>
    </section>

    <section class="grid gap-6 sm:grid-cols-3">
      <div class="space-y-2">
        <h2 class="font-medium">{{ t('dt.border.title') }}</h2>
        <div v-for="name in borderNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="block w-16 bg-primary" :style="{ height: `${tokens.border[name]!.value}rem` }" />
          <span class="ml-auto text-xs text-muted">{{ remText(tokens.border[name]!.value) }}</span>
        </div>
        <p v-if="!borderNames.length" class="text-sm text-warning">{{ t('dt.border.none') }}</p>
      </div>
      <div class="space-y-2">
        <h2 class="font-medium">{{ t('dt.icon.title') }}</h2>
        <div v-for="name in iconNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="block rounded bg-primary/30" :style="{ width: `${tokens.icon[name]!.value}rem`, height: `${tokens.icon[name]!.value}rem` }" />
          <span class="ml-auto text-xs text-muted">{{ remText(tokens.icon[name]!.value) }}</span>
        </div>
        <p v-if="!iconNames.length" class="text-sm text-warning">{{ t('dt.icon.none') }}</p>
      </div>
      <div class="space-y-2">
        <h2 class="font-medium">{{ t('dt.motion.title') }}</h2>
        <div v-for="name in motionNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span class="text-xs">{{ tokens.motion[name]!.value }} {{ t('dt.ms') }}</span>
          <span class="ml-auto text-xs text-muted">{{ tokens.motion[name]!.source }}</span>
        </div>
        <p v-if="!motionNames.length" class="text-sm text-warning">{{ t('dt.motion.none') }}</p>
        <p class="text-xs text-muted">{{ t('dt.motion.note') }}</p>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="font-medium">{{ t('dt.grid.title') }}</h2>
      <p v-if="!tokens.grid.columns && !breakpointNames.length" class="text-sm text-warning">{{ t('dt.grid.none') }}</p>
      <template v-else>
        <p class="text-sm text-muted">
          {{ t('dt.grid.summary', { columns: gridColumns, gutter: remText(gridGutter) }) }}
          <span v-if="tokens.grid.columns" class="text-xs">{{ sourceLabel(tokens.grid.columns) }}</span>
        </p>
        <div
          class="grid ds-card ds-card--bordered bg-elevated p-2"
          :style="{ gridTemplateColumns: `repeat(${gridColumns}, minmax(0, 1fr))`, gap: `${gridGutter}rem` }"
          aria-hidden="true"
        >
          <span v-for="count in gridColumns" :key="count" class="h-8 rounded-sm bg-primary/20" />
        </div>
        <div class="overflow-x-auto">
          <table class="ds-table w-full min-w-[24rem] text-left text-sm">
            <thead class="text-xs text-muted">
              <tr>
                <th class="pr-3">{{ t('dt.grid.col.point') }}</th>
                <th class="pr-3">{{ t('dt.grid.col.from') }}</th>
                <th class="pr-3">{{ t('dt.grid.col.container') }}</th>
                <th>{{ t('dt.col.source') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="name in breakpointNames" :key="name" class="border-t border-default">
                <td class="py-1.5 pr-3 font-mono text-xs">
                  {{ name }}
                  <span v-if="developer" class="block text-muted">--ds-bp-{{ name }}</span>
                </td>
                <td class="py-1.5 pr-3">{{ remText(tokens.grid.breakpoints[name]!.value) }}</td>
                <td class="py-1.5 pr-3">
                  <template v-if="containerNames.includes(name)">{{ remText(tokens.grid.containers[name]!.value) }}</template>
                  <span v-else class="text-muted">{{ t('dt.grid.full') }}</span>
                </td>
                <td class="py-1.5 text-xs text-muted">{{ sourceLabel(tokens.grid.breakpoints[name]!) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>

    <section class="space-y-2">
      <h2 class="font-medium">{{ t('dt.i18n.title') }}</h2>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <UBadge v-for="item in tokens.i18n.locales" :key="item.value" color="neutral" variant="subtle" size="sm">
          {{ item.value }}
          <template v-if="tokens.i18n.default?.value === item.value"> · {{ t('dt.i18n.default') }}</template>
          <template v-if="tokens.i18n.fallback?.value === item.value"> · {{ t('dt.i18n.fallback') }}</template>
        </UBadge>
        <span v-if="!locales.length" class="text-warning">{{ t('dt.i18n.none') }}</span>
        <span v-else-if="i18nTrouble" class="text-warning">{{ t('dt.i18n.trouble') }}</span>
      </div>
      <p class="text-xs text-muted">{{ t('dt.i18n.note') }}</p>
    </section>

    <section v-if="tokens.audience.markets.length || tokens.audience.outdoor" class="space-y-2">
      <h2 class="font-medium">{{ t('dt.audience.title') }}</h2>
      <div class="flex flex-wrap items-center gap-2 text-sm">
        <UBadge v-for="item in tokens.audience.markets" :key="item.value" color="neutral" variant="subtle" size="sm">{{ item.value }}</UBadge>
        <UBadge v-if="tokens.audience.outdoor?.value" color="warning" variant="subtle" size="sm">{{ t('dt.audience.outdoor') }}</UBadge>
      </div>
      <p class="text-xs text-muted">{{ t('dt.audience.note') }}</p>
    </section>

    <section v-if="tokens.principles.length" class="space-y-2">
      <h2 class="font-medium">{{ t('dt.principles.title') }}</h2>
      <ul class="space-y-1 text-sm">
        <li v-for="item in tokens.principles" :key="item.value" class="flex flex-wrap gap-x-3">
          <span>{{ item.value }}</span>
          <span class="text-xs text-muted">{{ item.source }}</span>
        </li>
      </ul>
    </section>

    <section v-if="checks.length" class="space-y-2">
      <h2 class="font-medium">{{ t('dt.findings.title') }}</h2>
      <ul class="space-y-1 text-sm">
        <li v-for="(check, at) in checks" :key="at" class="flex gap-2">
          <code class="shrink-0 text-xs text-warning">{{ check.code }}</code>
          <span>{{ check.message }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
