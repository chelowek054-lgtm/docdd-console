<script setup lang="ts">
import {
  DESIGN_THEMES,
  PALETTE_ROLES,
  RADIUS_NAMES,
  SPACING_NAMES,
  TYPOGRAPHY_NAMES,
  type ContrastRow,
  type DesignCheck,
  type DesignTheme,
  type DesignTokens
} from '~~/server/lib/design';

/**
 * Токены проекта после сложения «общее → локальное» (docs/04-ui.md, «Дизайн»):
 * палитра обеих тем рядом с числами контраста, шкалы в натуральную величину,
 * принципы. У каждой части — откуда она. Образцы — свои элементы со своим
 * фоном, а не токены Nuxt UI: экран показывает именно значения токенов.
 */
const props = defineProps<{
  tokens: DesignTokens;
  contrast: ContrastRow[];
  checks: DesignCheck[];
}>();

const THEME_LABEL: Record<DesignTheme, string> = { light: 'Светлая', dark: 'Тёмная' };

const roles = computed(() => {
  const names = new Set<string>(PALETTE_ROLES);
  for (const theme of DESIGN_THEMES) for (const role of Object.keys(props.tokens.palette[theme])) names.add(role);
  return [...names];
});

/** Число контраста у роли, если она — текст в какой-то из проверяемых пар. */
function ratioFor(theme: DesignTheme, role: string): ContrastRow[] {
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

const sourceLabel = (item: { source: string; level: string; overrides: string[] }) =>
  item.overrides.length ? `${item.source} (перекрыл ${item.overrides.join(', ')})` : item.source;
</script>

<template>
  <div class="space-y-8">
    <section class="space-y-3">
      <h2 class="font-medium">Палитра по ролям</h2>
      <p class="text-sm text-muted">
        Светлая и тёмная тема рядом. У текстовых ролей — контраст с их фоном; ниже 4.5:1 подсвечено.
      </p>
      <div class="overflow-x-auto">
        <table class="w-full min-w-[34rem] text-left text-sm">
          <thead class="text-xs text-muted">
            <tr>
              <th class="pr-3">Роль</th>
              <th v-for="theme in DESIGN_THEMES" :key="theme" class="pr-3">{{ THEME_LABEL[theme] }}</th>
              <th>Источник</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="role in roles" :key="role" class="border-t border-default align-middle">
              <td class="py-1.5 pr-3 font-mono text-xs">{{ role }}</td>
              <td v-for="theme in DESIGN_THEMES" :key="theme" class="py-1.5 pr-3">
                <div v-if="tokens.palette[theme][role]" class="flex items-center gap-2">
                  <span
                    class="inline-flex h-9 w-24 items-center justify-center rounded border border-default font-mono text-xs"
                    :style="{ backgroundColor: tokens.palette[theme][role]!.value, color: labelColor(tokens.palette[theme][role]!.value) }"
                  >{{ tokens.palette[theme][role]!.value }}</span>
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
      <div class="grid gap-3 sm:grid-cols-2">
        <div v-for="theme in DESIGN_THEMES" :key="theme" class="space-y-2">
          <p class="text-xs text-muted">{{ THEME_LABEL[theme] }}</p>
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
      <div class="space-y-2">
        <div v-for="name in typographyNames" :key="name" class="flex flex-wrap items-baseline gap-x-4 border-t border-default pt-2">
          <span class="w-20 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span
            class="min-w-0"
            :style="{
              fontSize: `${tokens.typography[name]!.value.size}px`,
              lineHeight: tokens.typography[name]!.value.line ? `${tokens.typography[name]!.value.line}px` : undefined,
              fontWeight: tokens.typography[name]!.value.weight
            }"
          >Съешь ещё этих мягких булок</span>
          <span class="ml-auto text-xs text-muted">
            {{ tokens.typography[name]!.value.size }}/{{ tokens.typography[name]!.value.line ?? '—' }} · {{ tokens.typography[name]!.value.weight ?? '—' }}
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
          <span class="h-3 rounded-sm bg-primary" :style="{ width: `${tokens.spacing[name]!.value}px` }" />
          <span class="ml-auto text-xs text-muted">{{ tokens.spacing[name]!.value }} px</span>
        </div>
      </div>
      <div class="space-y-2">
        <h2 class="font-medium">Радиусы</h2>
        <div v-for="name in radiusNames" :key="name" class="flex items-center gap-3 border-t border-default pt-2 text-sm">
          <span class="w-12 shrink-0 font-mono text-xs text-muted">{{ name }}</span>
          <span
            class="h-10 w-20 border border-default bg-elevated"
            :style="{ borderRadius: `${Math.min(tokens.radius[name]!.value, 20)}px` }"
          />
          <span class="ml-auto text-xs text-muted">{{ tokens.radius[name]!.value }} px</span>
        </div>
      </div>
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
