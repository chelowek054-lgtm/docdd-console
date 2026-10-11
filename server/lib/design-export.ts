import { capsClasses, surfaceVariables } from './design-surface';
import {
  COMPONENT_NAMES,
  PALETTE_ROLES,
  RADIUS_NAMES,
  SPACING_NAMES,
  TYPOGRAPHY_NAMES,
  BREAKPOINT_NAMES,
  CONTAINER_NAMES,
  BORDER_NAMES,
  ICON_NAMES,
  MOTION_NAMES,
  type BaseTheme,
  type PlainTokens
} from './design';

/**
 * Выгрузка токенов дизайна в файлы темы четырёх стеков (docs/16-design-system.md,
 * «Стеки и выгрузка») и сверка файла проекта с тем, что дала бы выгрузка.
 * Чистые функции: одинаковый вход — одинаковый текст, поэтому тесты держат
 * выгрузку снимками. Приложение ничего не пишет в проект (ADR-0022): текст
 * показывается, а файл меняет задача модели в своей ветке.
 *
 * Токены хранятся в `rem` (ADR-0023). Вебу они уходят как есть — размер следует
 * за настройкой шрифта пользователя; платформам без rem (Expo, Compose,
 * SwiftUI) значение переводится как `rem × root`.
 */

export type StackId = 'nuxt-ui' | 'expo' | 'compose' | 'swiftui';

export const STACK_IDS: readonly StackId[] = ['nuxt-ui', 'expo', 'compose', 'swiftui'];

export const STACK_LABEL: Readonly<Record<StackId, string>> = {
  'nuxt-ui': 'Nuxt + Nuxt UI',
  expo: 'React Native + Expo',
  compose: 'Kotlin / Compose',
  swiftui: 'Swift / SwiftUI'
};

export interface ExportFile {
  /** Ключ файла в `design.stacks[].files` манифеста. */
  key: string;
  /** Путь по умолчанию относительно корня проекта; манифест может назвать свой. */
  defaultPath: string;
  content: string;
  /**
   * `true` — в файле проекта живёт только блок между метками `docdd-design:start`
   * и `docdd-design:end`, остальное в файле принадлежит проекту (main.css).
   */
  region?: boolean;
}

export interface StackExport {
  id: StackId;
  files: ExportFile[];
}

export interface ExportOptions {
  /** Пакет Kotlin (`compose`); по умолчанию `ui.theme`. */
  package?: string | undefined;
}

export const REGION_START = 'docdd-design:start';
export const REGION_END = 'docdd-design:end';

/** Шапка файла: версия токенов называется — по ней сверка видит, на какой версии отстал файл проекта. */
const headerOf = (tokens: PlainTokens) =>
  `Сгенерировано консолью DocDD из токенов дизайна v${tokens.version} (docs/16-design-system.md). Не правьте руками: меняются токены.`;

/** Версия токенов из шапки файла проекта; `null` — шапки нет. */
export function versionOfFile(text: string | null): string | null {
  const match = text ? /токенов дизайна v(\d+\.\d+\.\d+)/.exec(text) : null;
  return match?.[1] ?? null;
}

/* ---------- общие помощники ---------- */

/** Имена в порядке: сперва обязательные, как в эталоне, потом остальные по алфавиту. */
function ordered(bag: Record<string, unknown>, required: readonly string[]): string[] {
  const first = required.filter((name) => name in bag);
  const rest = Object.keys(bag).filter((name) => !required.includes(name)).sort();
  return [...first, ...rest];
}

const rolesOf = (palette: Record<string, string>) => ordered(palette, PALETTE_ROLES);

/** `#RRGGBB` без прозрачности и `#RRGGBBAA` с ней — раздельно. */
function channels(color: string): { r: number; g: number; b: number; a: number } {
  const hex = color.slice(1);
  const at = (index: number) => parseInt(hex.slice(index, index + 2), 16);
  return { r: at(0), g: at(2), b: at(4), a: hex.length === 8 ? at(6) : 255 };
}

const upperHex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();

const cssName = (role: string) => role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const pascal = (role: string) => role.split(/[-_\s]+/).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');

const lines = (...parts: string[]) => `${parts.join('\n')}\n`;

/** Число без хвоста нулей: `1.5`, а не `1.5000`; в rem четвёртого знака хватает на 1/16. */
const trim = (value: number, digits = 4) => String(Number(value.toFixed(digits)));

/** Значение в rem для CSS. */
const rem = (value: number) => `${trim(value)}rem`;

/** rem → логические единицы платформы без rem: dp, pt, px React Native. */
const toUnits = (value: number, root: number) => Number((value * root).toFixed(2));

/** Тема: имя, база и итоговая палитра — светлая и тёмная первыми, как в блоке. */
interface ThemeView {
  name: string;
  mode: BaseTheme;
  palette: Record<string, string>;
  custom: boolean;
}

function themeViews(tokens: PlainTokens): ThemeView[] {
  return [
    { name: 'light', mode: 'light', palette: tokens.palette.light, custom: false },
    { name: 'dark', mode: 'dark', palette: tokens.palette.dark, custom: false },
    ...Object.entries(tokens.themes).map(([name, theme]) => ({ name, mode: theme.mode, palette: theme.palette, custom: true }))
  ];
}

/* ---------- Nuxt UI ---------- */

/** Роли палитры → переменные Nuxt UI v4; остальное идёт только своими `--ds-*`. */
const NUXT_UI_MAP: Readonly<Record<string, readonly string[]>> = {
  bg: ['--ui-bg'],
  surface: ['--ui-bg-elevated'],
  surfaceAlt: ['--ui-bg-muted', '--ui-bg-accented'],
  ink: ['--ui-text', '--ui-text-highlighted'],
  muted: ['--ui-text-muted'],
  line: ['--ui-border'],
  accent: ['--ui-primary'],
  ok: ['--ui-success'],
  info: ['--ui-info'],
  warn: ['--ui-warning'],
  danger: ['--ui-error']
};

/** Классы сетки по образцу Bootstrap 5: контейнер, ряд, колонки; от меньшей ширины к большей. */
function gridCss(tokens: PlainTokens): string[] {
  const { columns, breakpoints, containers } = tokens.grid;
  const points = ordered(breakpoints, BREAKPOINT_NAMES);
  const share = (count: number) => `${trim((count / columns) * 100, 6)}%`;

  const columnRules = (suffix: string, indent: string): string[] => {
    const prefix = suffix === '' ? 'ds-col' : `ds-col-${suffix}`;
    const out = [`${indent}.${prefix} { flex: 1 0 0%; }`, `${indent}.${prefix}-auto { flex: 0 0 auto; width: auto; }`];
    for (let count = 1; count <= columns; count += 1) {
      out.push(`${indent}.${prefix}-${count} { flex: 0 0 auto; width: ${share(count)}; }`);
    }
    return out;
  };

  const out: string[] = [
    '.ds-container {',
    '  width: 100%;',
    '  margin-inline: auto;',
    '  padding-inline: calc(var(--ds-grid-gutter) / 2);',
    '}',
    '.ds-row {',
    '  display: flex;',
    '  flex-wrap: wrap;',
    '  margin-inline: calc(var(--ds-grid-gutter) / -2);',
    '}',
    '.ds-row > * {',
    '  box-sizing: border-box;',
    '  flex-shrink: 0;',
    '  width: 100%;',
    '  max-width: 100%;',
    '  padding-inline: calc(var(--ds-grid-gutter) / 2);',
    '}',
    ...columnRules('', '')
  ];

  for (const point of points) {
    const from = breakpoints[point]!;
    if (from === 0) continue;
    out.push(`@media (min-width: ${rem(from)}) {`);
    if (point in containers) out.push(`  .ds-container { max-width: ${rem(containers[point]!)}; }`);
    out.push(...columnRules(point, '  '), '}');
  }
  return out;
}

/** Фокус, движение и печать: то, без чего интерфейс недоступен (ADR-0024). */
function accessibilityCss(tokens: PlainTokens): string[] {
  const motion = ordered(tokens.motion, MOTION_NAMES).map((name) => `    --ds-motion-${cssName(name)}: 0ms;`);
  return [
    '/* Видимый фокус: условие работы с клавиатуры (WCAG 2.1 AA). */',
    ':focus-visible {',
    '  outline: var(--ds-border-thick, 0.125rem) solid var(--ds-color-focus, currentColor);',
    '  outline-offset: 0.125rem;',
    '}',
    '',
    '/* Тем, кому движение вредит, оно отключается само. */',
    '@media (prefers-reduced-motion: reduce) {',
    '  :root {',
    ...motion,
    '  }',
    '  *, *::before, *::after {',
    '    animation-duration: 0.01ms !important;',
    '    transition-duration: 0.01ms !important;',
    '    scroll-behavior: auto !important;',
    '  }',
    '}',
    '',
    '/* Версия для печати: светлая и на всю ширину. */',
    '@media print {',
    '  :root { color-scheme: light; }',
    '  .ds-container { max-width: none; }',
    '}'
  ];
}

function nuxtCss(tokens: PlainTokens): string {
  const scale = (prefix: string, bag: Record<string, number>, required: readonly string[]): string[] =>
    ordered(bag, required).map((name) => `  --ds-${prefix}-${cssName(name)}: ${rem(bag[name]!)};`);

  const typography: string[] = [];
  for (const name of ordered(tokens.typography, TYPOGRAPHY_NAMES)) {
    const token = tokens.typography[name]!;
    typography.push(`  --ds-font-${cssName(name)}: ${rem(token.size)};`);
    if (token.line !== undefined) typography.push(`  --ds-line-${cssName(name)}: ${rem(token.line)};`);
    if (token.weight !== undefined) typography.push(`  --ds-weight-${cssName(name)}: ${token.weight};`);
  }

  const points = ordered(tokens.grid.breakpoints, BREAKPOINT_NAMES);
  const themeBlock = (view: ThemeView): string[] => {
    const selector = view.name === 'light' ? ':root' : view.custom ? `.theme-${view.name}` : `.${view.name}`;
    const out: string[] = [`${selector} {`, `  color-scheme: ${view.mode};`];
    for (const role of rolesOf(view.palette)) out.push(`  --ds-color-${cssName(role)}: ${view.palette[role]};`);
    for (const role of rolesOf(view.palette)) {
      for (const name of NUXT_UI_MAP[role] ?? []) out.push(`  ${name}: ${view.palette[role]};`);
    }
    out.push('}');
    return out;
  };

  /** Тема `contrast` включается и системной настройкой «повысить контраст» (ADR-0026). */
  const contrastPreference = (): string[] => {
    const view = themeViews(tokens).find((item) => item.name === 'contrast' && item.custom);
    if (!view) return [];
    const [, ...body] = themeBlock(view);
    return [
      '/* Системная настройка «повысить контраст» включает палитру темы contrast. */',
      '@media (prefers-contrast: more) {',
      '  :root {',
      ...body.map((line) => `  ${line}`),
      '}',
      ''
    ];
  };

  return lines(
    `/* ${REGION_START} — ${headerOf(tokens)} */`,
    '/* Размеры в rem: следуют за настройкой шрифта пользователя; корень не задаётся в px. */',
    'html { font-size: 100%; }',
    '',
    '/* Точки перелома Tailwind совпадают с сеткой, поэтому md: и ds-col-md-* срабатывают на одной ширине. */',
    '@theme {',
    ...points.filter((point) => point !== 'xs').map((point) => `  --breakpoint-${point}: ${rem(tokens.grid.breakpoints[point]!)};`),
    '}',
    '',
    ':root {',
    ...scale('space', tokens.spacing, SPACING_NAMES),
    ...scale('radius', tokens.radius, RADIUS_NAMES),
    ...typography,
    `  --ds-grid-columns: ${tokens.grid.columns};`,
    `  --ds-grid-gutter: ${rem(tokens.grid.gutter)};`,
    ...points.map((point) => `  --ds-bp-${point}: ${rem(tokens.grid.breakpoints[point]!)};`),
    ...ordered(tokens.border, BORDER_NAMES).map((name) => `  --ds-border-${cssName(name)}: ${rem(tokens.border[name]!)};`),
    ...surfaceVariables(tokens.surface),
    ...ordered(tokens.icon, ICON_NAMES).map((name) => `  --ds-icon-${cssName(name)}: ${rem(tokens.icon[name]!)};`),
    ...ordered(tokens.motion, MOTION_NAMES).map((name) => `  --ds-motion-${cssName(name)}: ${trim(tokens.motion[name]!)}ms;`),
    ...Object.keys(tokens.fonts).sort().map((name) => `  --ds-font-family-${cssName(name)}: ${tokens.fonts[name]};`),
    `  --ds-measure: ${trim(tokens.measure)}ch;`,
    '}',
    '',
    ...themeViews(tokens).flatMap((view) => [...themeBlock(view), '']),
    ...contrastPreference(),
    ...gridCss(tokens),
    '',
    ...capsClasses(tokens.surface),
    ...(Object.keys(tokens.surface.caps).length > 0 ? [''] : []),
    ...accessibilityCss(tokens),
    `/* ${REGION_END} */`
  );
}

function nuxtTokensTs(tokens: PlainTokens): string {
  const plain = {
    unit: 'rem',
    spacing: tokens.spacing,
    radius: tokens.radius,
    typography: tokens.typography,
    border: tokens.border,
    icon: tokens.icon,
    motion: tokens.motion,
    fonts: tokens.fonts,
    measure: tokens.measure,
    grid: tokens.grid,
    palette: tokens.palette,
    themes: tokens.themes,
    surface: tokens.surface,
    i18n: tokens.i18n
  };
  return lines(
    `// ${headerOf(tokens)}`,
    '// Размеры в rem. Языки — точка подключения словарей (@nuxtjs/i18n и подобные).',
    '',
    `export const designTokens = ${JSON.stringify(plain, null, 2)} as const;`,
    '',
    'export type DesignTokens = typeof designTokens;',
    'export const locales = designTokens.i18n.locales;'
  );
}

/* ---------- Expo ---------- */

function expoTheme(tokens: PlainTokens): string {
  const { root } = tokens;
  const views = themeViews(tokens);
  const colors = (view: ThemeView) => [
    `export const ${pascal(view.name)}Colors = {`,
    ...rolesOf(view.palette).map((role) => `  ${role}: '${view.palette[role]}',`),
    '} as const;'
  ];
  const typography = ordered(tokens.typography, TYPOGRAPHY_NAMES).map((name) => {
    const token = tokens.typography[name]!;
    const parts = [`fontSize: ${toUnits(token.size, root)}`];
    if (token.line !== undefined) parts.push(`lineHeight: ${toUnits(token.line, root)}`);
    if (token.weight !== undefined) parts.push(`fontWeight: '${token.weight}'`);
    return `  ${name}: { ${parts.join(', ')} },`;
  });
  const numbers = (name: string, bag: Record<string, number>, required: readonly string[]) => [
    `export const ${name} = {`,
    ...ordered(bag, required).map((key) => `  ${key}: ${toUnits(bag[key]!, root)},`),
    '} as const;'
  ];
  const grid = (name: string, bag: Record<string, number>, required: readonly string[]) => [
    `  ${name}: {`,
    ...ordered(bag, required).map((key) => `    ${key}: ${toUnits(bag[key]!, root)},`),
    '  },'
  ];

  return lines(
    `// ${headerOf(tokens)}`,
    `// Размеры — rem × ${root}: у React Native нет rem, а масштаб шрифта системы остаётся включённым.`,
    "import { useColorScheme } from 'react-native';",
    '',
    ...views.flatMap((view) => [...colors(view), '']),
    'export type ThemeColors = typeof LightColors;',
    '',
    'export const Themes = {',
    ...views.map((view) => `  ${view.name.includes('-') ? `'${view.name}'` : view.name}: ${pascal(view.name)}Colors,`),
    '} as const;',
    '',
    'export type ThemeName = keyof typeof Themes;',
    '',
    ...numbers('spacing', tokens.spacing, SPACING_NAMES),
    '',
    ...numbers('radius', tokens.radius, RADIUS_NAMES),
    '',
    ...numbers('border', tokens.border, BORDER_NAMES),
    '',
    ...numbers('icon', tokens.icon, ICON_NAMES),
    '',
    '/** Длительности, мс; при «уменьшить движение» в системе компонент обязан их обнулить. */',
    'export const motion = {',
    ...ordered(tokens.motion, MOTION_NAMES).map((name) => `  ${name}: ${tokens.motion[name]},`),
    '} as const;',
    '',
    'export const fonts = {',
    ...Object.keys(tokens.fonts).sort().map((name) => `  ${name}: ${JSON.stringify(tokens.fonts[name])},`),
    '} as const;',
    '',
    `/** Длина строки в символах: ограничивайте ширину текстового блока. */`,
    `export const measure = ${tokens.measure};`,
    '',
    'export const typography = {',
    ...typography,
    '} as const;',
    '',
    'export const grid = {',
    `  columns: ${tokens.grid.columns},`,
    `  gutter: ${toUnits(tokens.grid.gutter, root)},`,
    ...grid('breakpoints', tokens.grid.breakpoints, BREAKPOINT_NAMES),
    ...grid('containers', tokens.grid.containers, CONTAINER_NAMES),
    '} as const;',
    '',
    '/** Точка сетки для ширины экрана в dp: наибольшая из тех, что не больше ширины. */',
    'export function breakpointFor(width: number): keyof typeof grid.breakpoints {',
    '  const names = Object.keys(grid.breakpoints) as (keyof typeof grid.breakpoints)[];',
    '  return names.filter((name) => grid.breakpoints[name] <= width).pop() ?? names[0]!;',
    '}',
    '',
    'export const i18n = {',
    `  default: '${tokens.i18n.default}',`,
    `  fallback: '${tokens.i18n.fallback}',`,
    `  locales: [${tokens.i18n.locales.map((locale) => `'${locale}'`).join(', ')}],`,
    '} as const;',
    '',
    '/** Палитра по имени темы; без имени — по системной теме, `null` из `useColorScheme()` — светлая. */',
    'export function useThemeColors(name?: ThemeName): ThemeColors {',
    '  const scheme = useColorScheme();',
    "  return Themes[name ?? (scheme === 'dark' ? 'dark' : 'light')];",
    '}'
  );
}

/* ---------- Compose ---------- */

const kotlinColor = (hex: string) => {
  const { r, g, b, a } = channels(hex);
  return `Color(0x${upperHex(a)}${upperHex(r)}${upperHex(g)}${upperHex(b)})`;
};

/** Роль → параметр `ColorScheme` Material 3; остальные идут в `AppExtraColors`. */
const COMPOSE_SCHEME: readonly (readonly [string, string])[] = [
  ['background', 'bg'],
  ['onBackground', 'ink'],
  ['surface', 'surface'],
  ['onSurface', 'ink'],
  ['surfaceVariant', 'surfaceAlt'],
  ['onSurfaceVariant', 'muted'],
  ['outline', 'line'],
  ['primary', 'accent'],
  ['onPrimary', 'onAccent'],
  ['error', 'danger'],
  ['onError', 'onDanger']
];

const COMPOSE_EXTRA = ['accentText', 'core', 'ok', 'info', 'warn'] as const;

function composePackage(options: ExportOptions): string {
  return options.package && options.package.trim() !== '' ? options.package.trim() : 'ui.theme';
}

function composeColor(tokens: PlainTokens, options: ExportOptions): string {
  const out: string[] = [
    `// ${headerOf(tokens)}`,
    `package ${composePackage(options)}`,
    '',
    'import androidx.compose.material3.ColorScheme',
    'import androidx.compose.material3.darkColorScheme',
    'import androidx.compose.material3.lightColorScheme',
    'import androidx.compose.ui.graphics.Color',
    ''
  ];
  const views = themeViews(tokens);
  for (const view of views) {
    const prefix = pascal(view.name);
    for (const role of rolesOf(view.palette)) out.push(`val ${prefix}${pascal(role)} = ${kotlinColor(view.palette[role]!)}`);
    out.push('');
  }
  for (const view of views) {
    const prefix = pascal(view.name);
    const parameters = COMPOSE_SCHEME.filter(([, role]) => role in view.palette)
      .map(([param, role]) => `    ${param} = ${prefix}${pascal(role)},`);
    const factory = view.mode === 'dark' ? 'darkColorScheme' : 'lightColorScheme';
    out.push(`val ${prefix}ColorScheme: ColorScheme = ${factory}(`, ...parameters, ')', '');
  }
  out.push('/** Роли, которых нет в Material 3: смысловой цвет ядра и состояния. */');
  out.push('data class AppExtraColors(val core: Color, val ok: Color, val warn: Color)', '');
  for (const view of views) {
    const prefix = pascal(view.name);
    const args = COMPOSE_EXTRA.filter((role) => role in view.palette).map((role) => `${role} = ${prefix}${pascal(role)}`);
    out.push(`val ${prefix}ExtraColors = AppExtraColors(${args.join(', ')})`);
  }
  return lines(...out);
}

/** Кегль → стиль Material 3 (`caption` — самый мелкий, `display` — самый крупный). */
const COMPOSE_TYPE: Readonly<Record<string, string>> = {
  caption: 'labelSmall',
  small: 'bodySmall',
  body: 'bodyMedium',
  lead: 'titleMedium',
  title: 'titleLarge',
  display: 'headlineMedium'
};

function composeType(tokens: PlainTokens, options: ExportOptions): string {
  const styles = Object.entries(COMPOSE_TYPE)
    .filter(([name]) => name in tokens.typography)
    .map(([name, style]) => {
      const token = tokens.typography[name]!;
      const parts = [`fontSize = ${toUnits(token.size, tokens.root)}.sp`];
      if (token.line !== undefined) parts.push(`lineHeight = ${toUnits(token.line, tokens.root)}.sp`);
      if (token.weight !== undefined) parts.push(`fontWeight = FontWeight.W${token.weight}`);
      return `    ${style} = TextStyle(${parts.join(', ')}),`;
    });
  return lines(
    `// ${headerOf(tokens)}`,
    `// Размеры — rem × ${tokens.root}; sp следует за масштабом шрифта системы.`,
    `package ${composePackage(options)}`,
    '',
    'import androidx.compose.material3.Typography',
    'import androidx.compose.ui.text.TextStyle',
    'import androidx.compose.ui.text.font.FontWeight',
    'import androidx.compose.ui.unit.sp',
    '',
    'val AppTypography = Typography(',
    ...styles,
    ')'
  );
}

function composeShape(tokens: PlainTokens, options: ExportOptions): string {
  const radius = (name: string) => `${toUnits(tokens.radius[name] ?? 0, tokens.root)}.dp`;
  return lines(
    `// ${headerOf(tokens)}`,
    `package ${composePackage(options)}`,
    '',
    'import androidx.compose.foundation.shape.RoundedCornerShape',
    'import androidx.compose.material3.Shapes',
    'import androidx.compose.ui.unit.dp',
    '',
    'val AppShapes = Shapes(',
    `    small = RoundedCornerShape(${radius('sm')}),`,
    `    medium = RoundedCornerShape(${radius('md')}),`,
    `    large = RoundedCornerShape(${radius('md')}),`,
    ')',
    '',
    '/** Плашка: полностью скруглённая. */',
    `val PillShape = RoundedCornerShape(${radius('pill')})`
  );
}

function composeTheme(tokens: PlainTokens, options: ExportOptions): string {
  const { root } = tokens;
  const views = themeViews(tokens);
  const spacing = ordered(tokens.spacing, SPACING_NAMES).map((name) => `    val ${name} = ${toUnits(tokens.spacing[name]!, root)}.dp`);
  const dpMap = (bag: Record<string, number>, required: readonly string[]) =>
    ordered(bag, required).map((name) => `"${name}" to ${toUnits(bag[name]!, root)}.dp`).join(', ');
  const cases = views.map((view) => pascal(view.name));

  return lines(
    `// ${headerOf(tokens)}`,
    `package ${composePackage(options)}`,
    '',
    'import androidx.compose.foundation.isSystemInDarkTheme',
    'import androidx.compose.material3.MaterialTheme',
    'import androidx.compose.runtime.Composable',
    'import androidx.compose.runtime.CompositionLocalProvider',
    'import androidx.compose.runtime.staticCompositionLocalOf',
    'import androidx.compose.ui.unit.dp',
    '',
    '/** Темы продукта: светлая и тёмная — база, остальные поверх. */',
    `enum class AppThemeName { ${cases.join(', ')} }`,
    '',
    'val LocalExtraColors = staticCompositionLocalOf { LightExtraColors }',
    '',
    'object AppSpacing {',
    ...spacing,
    '}',
    '',
    'object AppBorder {',
    ...ordered(tokens.border, BORDER_NAMES).map((name) => `    val ${name} = ${toUnits(tokens.border[name]!, root)}.dp`),
    '}',
    '',
    'object AppIcon {',
    ...ordered(tokens.icon, ICON_NAMES).map((name) => `    val ${name} = ${toUnits(tokens.icon[name]!, root)}.dp`),
    '}',
    '',
    '/** Длительности, мс; при «убрать анимации» в системе компонент обязан их обнулить. */',
    'object AppMotion {',
    ...ordered(tokens.motion, MOTION_NAMES).map((name) => `    const val ${name} = ${tokens.motion[name]}`),
    '}',
    '',
    'object AppFonts {',
    ...Object.keys(tokens.fonts).sort().map((name) => `    const val ${name} = ${JSON.stringify(tokens.fonts[name])}`),
    `    const val measure = ${tokens.measure}`,
    '}',
    '',
    '/** Сетка: колонки, поле и точки перелома в dp (rem × root). */',
    'object AppGrid {',
    `    const val columns = ${tokens.grid.columns}`,
    `    val gutter = ${toUnits(tokens.grid.gutter, root)}.dp`,
    `    val breakpoints = mapOf(${dpMap(tokens.grid.breakpoints, BREAKPOINT_NAMES)})`,
    `    val containers = mapOf(${dpMap(tokens.grid.containers, CONTAINER_NAMES)})`,
    '}',
    '',
    '/** Языки продукта: точка подключения словарей. */',
    'object AppLocales {',
    `    const val default = "${tokens.i18n.default}"`,
    `    const val fallback = "${tokens.i18n.fallback}"`,
    `    val all = listOf(${tokens.i18n.locales.map((locale) => `"${locale}"`).join(', ')})`,
    '}',
    '',
    '@Composable',
    'fun AppTheme(',
    '    theme: AppThemeName? = null,',
    '    darkTheme: Boolean = isSystemInDarkTheme(),',
    '    content: @Composable () -> Unit,',
    ') {',
    '    val chosen = theme ?: if (darkTheme) AppThemeName.Dark else AppThemeName.Light',
    '    val scheme = when (chosen) {',
    ...cases.map((name) => `        AppThemeName.${name} -> ${name}ColorScheme`),
    '    }',
    '    val extra = when (chosen) {',
    ...cases.map((name) => `        AppThemeName.${name} -> ${name}ExtraColors`),
    '    }',
    '    CompositionLocalProvider(LocalExtraColors provides extra) {',
    '        MaterialTheme(',
    '            colorScheme = scheme,',
    '            typography = AppTypography,',
    '            shapes = AppShapes,',
    '            content = content,',
    '        )',
    '    }',
    '}'
  );
}

/* ---------- SwiftUI ---------- */

const SWIFT_WEIGHT: Readonly<Record<number, string>> = {
  100: 'ultraLight', 200: 'thin', 300: 'light', 400: 'regular', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'heavy', 900: 'black'
};

function swiftTheme(tokens: PlainTokens): string {
  const { root } = tokens;
  const numbers = (name: string, bag: Record<string, number>, required: readonly string[]) => [
    `    enum ${name} {`,
    ...ordered(bag, required).map((key) => `        static let ${key}: CGFloat = ${toUnits(bag[key]!, root)}`),
    '    }'
  ];
  const fonts = ordered(tokens.typography, TYPOGRAPHY_NAMES).map((name) => {
    const token = tokens.typography[name]!;
    const weight = SWIFT_WEIGHT[token.weight ?? 400] ?? 'regular';
    return `        static let ${name} = Font.system(size: ${toUnits(token.size, root)}, weight: .${weight})`;
  });
  const colors = rolesOf({ ...tokens.palette.light, ...tokens.palette.dark })
    .map((role) => `        static let ${role} = SwiftUI.Color("${role}")`);
  const hex = (value: string) => {
    const { r, g, b, a } = channels(value);
    return `0x${upperHex(a)}${upperHex(r)}${upperHex(g)}${upperHex(b)}`;
  };
  const custom = Object.entries(tokens.themes).flatMap(([name, theme]) => [
    '',
    `    /// Тема «${theme.label}»: база ${theme.mode}, цвета в коде, а не в каталоге ассетов.`,
    `    enum ${pascal(name)} {`,
    ...rolesOf(theme.palette).map((role) => `        static let ${role} = SwiftUI.Color(argb: ${hex(theme.palette[role]!)})`),
    '    }'
  ]);
  const dict = (bag: Record<string, number>, required: readonly string[]) =>
    ordered(bag, required).map((key) => `            "${key}": ${toUnits(bag[key]!, root)}`).join(',\n');

  return lines(
    `// ${headerOf(tokens)}`,
    `// Размеры — rem × ${root}; у SwiftUI нет rem, а Dynamic Type остаётся включённым.`,
    'import SwiftUI',
    '',
    'extension SwiftUI.Color {',
    '    /// Цвет из 0xAARRGGBB: для тем, которых нет в каталоге ассетов.',
    '    init(argb: UInt32) {',
    '        self.init(',
    '            .sRGB,',
    '            red: Double((argb >> 16) & 0xFF) / 255,',
    '            green: Double((argb >> 8) & 0xFF) / 255,',
    '            blue: Double(argb & 0xFF) / 255,',
    '            opacity: Double((argb >> 24) & 0xFF) / 255',
    '        )',
    '    }',
    '}',
    '',
    '/// Цвета светлой и тёмной тем берутся из каталога ассетов: у каждой роли варианты Any и Dark.',
    'enum AppTheme {',
    '    enum Colors {',
    ...colors,
    '    }',
    ...custom,
    '',
    ...numbers('Spacing', tokens.spacing, SPACING_NAMES),
    '',
    ...numbers('Radius', tokens.radius, RADIUS_NAMES),
    '',
    ...numbers('Border', tokens.border, BORDER_NAMES),
    '',
    ...numbers('Icon', tokens.icon, ICON_NAMES),
    '',
    '    /// Длительности в секундах; при «уменьшить движение» компонент обязан их обнулить.',
    '    enum Motion {',
    ...ordered(tokens.motion, MOTION_NAMES).map((name) => `        static let ${name}: Double = ${trim(tokens.motion[name]! / 1000, 4)}`),
    '    }',
    '',
    '    enum Fonts {',
    ...Object.keys(tokens.fonts).sort().map((name) => `        static let ${name} = ${JSON.stringify(tokens.fonts[name])}`),
    `        static let measure = ${tokens.measure}`,
    '    }',
    '',
    '    enum Typography {',
    ...fonts,
    '    }',
    '',
    '    /// Сетка: колонки, поле и точки перелома.',
    '    enum Grid {',
    `        static let columns = ${tokens.grid.columns}`,
    `        static let gutter: CGFloat = ${toUnits(tokens.grid.gutter, root)}`,
    '        static let breakpoints: [String: CGFloat] = [',
    dict(tokens.grid.breakpoints, BREAKPOINT_NAMES),
    '        ]',
    '        static let containers: [String: CGFloat] = [',
    dict(tokens.grid.containers, CONTAINER_NAMES),
    '        ]',
    '    }',
    '',
    '    /// Языки продукта: точка подключения словарей.',
    '    enum Locales {',
    `        static let standard = "${tokens.i18n.default}"`,
    `        static let fallback = "${tokens.i18n.fallback}"`,
    `        static let all = [${tokens.i18n.locales.map((locale) => `"${locale}"`).join(', ')}]`,
    '    }',
    '}'
  );
}

function swiftColorset(light: string | undefined, dark: string | undefined): string {
  const color = (hex: string) => {
    const { r, g, b, a } = channels(hex);
    const part = (value: number) => (value / 255).toFixed(3);
    return {
      'color-space': 'srgb',
      components: { alpha: part(a), blue: part(b), green: part(g), red: part(r) }
    };
  };
  const entries: object[] = [];
  const any = light ?? dark;
  if (any) entries.push({ color: color(any), idiom: 'universal' });
  if (dark) {
    entries.push({
      appearances: [{ appearance: 'luminosity', value: 'dark' }],
      color: color(dark),
      idiom: 'universal'
    });
  }
  return `${JSON.stringify({ colors: entries, info: { author: 'xcode', version: 1 } }, null, 2)}\n`;
}

/* ---------- сборка ---------- */

export function exportStack(id: StackId, tokens: PlainTokens, options: ExportOptions = {}): StackExport {
  switch (id) {
    case 'nuxt-ui':
      return {
        id,
        files: [
          { key: 'css', defaultPath: 'app/assets/css/main.css', content: nuxtCss(tokens), region: true },
          { key: 'config', defaultPath: 'app/design-tokens.ts', content: nuxtTokensTs(tokens) }
        ]
      };
    case 'expo':
      return { id, files: [{ key: 'theme', defaultPath: 'constants/theme.ts', content: expoTheme(tokens) }] };
    case 'compose':
      return {
        id,
        files: [
          { key: 'color', defaultPath: 'Color.kt', content: composeColor(tokens, options) },
          { key: 'type', defaultPath: 'Type.kt', content: composeType(tokens, options) },
          { key: 'shape', defaultPath: 'Shape.kt', content: composeShape(tokens, options) },
          { key: 'theme', defaultPath: 'Theme.kt', content: composeTheme(tokens, options) }
        ]
      };
    case 'swiftui':
      return {
        id,
        files: [
          { key: 'theme', defaultPath: 'Theme.swift', content: swiftTheme(tokens) },
          // Цвета каталога — только светлая и тёмная (Any/Dark): ключ `colors:<роль>`,
          // путь строится от каталога `colors` манифеста. Остальные темы — в Theme.swift.
          ...rolesOf({ ...tokens.palette.light, ...tokens.palette.dark }).map((role) => ({
            key: `colors:${role}`,
            defaultPath: `Assets.xcassets/${role}.colorset/Contents.json`,
            content: swiftColorset(tokens.palette.light[role], tokens.palette.dark[role])
          }))
        ]
      };
  }
}

export function isStackId(value: unknown): value is StackId {
  return typeof value === 'string' && (STACK_IDS as readonly string[]).includes(value);
}

/* ---------- сверка файла проекта ---------- */

export type FileState = 'in_sync' | 'drift' | 'missing' | 'unknown';

export interface FileComparison {
  state: FileState;
  /** Построчная разница «проект → выгрузка»; пусто, когда совпало. */
  diff: string;
}

const normalize = (text: string) => text.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim();

/** Блок между метками из файла проекта; `null` — меток нет. */
export function extractRegion(text: string): string | null {
  const body = text.replace(/\r\n/g, '\n');
  const start = body.indexOf(REGION_START);
  const end = body.indexOf(REGION_END);
  if (start < 0 || end < start) return null;
  const from = body.lastIndexOf('\n', start) + 1;
  const to = body.indexOf('\n', end);
  return body.slice(from, to < 0 ? body.length : to);
}

/** Построчная разница: самая длинная общая подпоследовательность, `-` было, `+` стало. */
export function lineDiff(before: string, after: string, limit = 200): string {
  const a = before.split('\n');
  const b = after.split('\n');
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      table[i]![j] = a[i] === b[j] ? table[i + 1]![j + 1]! + 1 : Math.max(table[i + 1]![j]!, table[i]![j + 1]!);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      i += 1;
      j += 1;
    } else if (j < b.length && (i >= a.length || table[i]![j + 1]! >= table[i + 1]![j]!)) {
      out.push(`+ ${b[j]}`);
      j += 1;
    } else {
      out.push(`- ${a[i]}`);
      i += 1;
    }
  }
  return out.length > limit ? [...out.slice(0, limit), `… ещё ${out.length - limit} строк`].join('\n') : out.join('\n');
}

/**
 * Сравнение выгрузки с файлом проекта. `actual === null` — файла нет;
 * у файла с блоком сравнивается только блок между метками.
 */
export function compareFile(expected: ExportFile, actual: string | null): FileComparison {
  if (actual === null) return { state: 'missing', diff: '' };
  const want = normalize(expected.content);
  const have = expected.region ? extractRegion(actual) : actual;
  if (have === null) {
    return { state: 'drift', diff: lineDiff('', want) };
  }
  const got = normalize(have);
  if (got === want) return { state: 'in_sync', diff: '' };
  return { state: 'drift', diff: lineDiff(got, want) };
}

/** Компоненты реестра нужны проекту: имя ищется в именах исходных файлов и модулей. */
export function requiredComponents(tokens: PlainTokens): string[] {
  const names = tokens.components.map((component) => component.name);
  return names.length > 0 ? names : [...COMPONENT_NAMES];
}

/* ---------- пути и компоненты проекта ---------- */

/** Путь только внутри проекта: без абсолютного пути и без `..`. */
export function isSafeRelative(path: string): boolean {
  if (path === '' || /^([a-zA-Z]:|[\\/])/.test(path)) return false;
  return !path.split(/[\\/]/).includes('..');
}

/**
 * Где файл лежит в проекте: путь из манифеста, иначе умолчание стека. Цвета
 * каталога ассетов SwiftUI строятся от каталога `colors`.
 */
export function projectFilePath(files: Record<string, string> | undefined, file: ExportFile): string {
  if (file.key.startsWith('colors:')) {
    const directory = files?.['colors'] ?? 'Assets.xcassets';
    return `${directory.replace(/[\\/]+$/, '')}/${file.key.slice('colors:'.length)}.colorset/Contents.json`;
  }
  return files?.[file.key] ?? file.defaultPath;
}

/** `TopBar` → `top-bar`, `top_bar`: проекты называют файлы компонентов по-разному. */
function nameVariants(name: string): string[] {
  const words = name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase().split(/\s+/);
  return [name.toLowerCase(), words.join('-'), words.join('_'), words.join('')];
}

/**
 * Компоненты реестра, которых нет в коде проекта: ищется файл или каталог с таким
 * именем среди файлов `sources.code`. `null` — искать негде (исходники не
 * объявлены), и это не «всё пропало».
 */
export function componentsMissing(
  names: readonly string[],
  codeFiles: readonly string[],
  provided: ReadonlySet<string> = new Set()
): string[] | null {
  if (codeFiles.length === 0) return null;
  const stems = new Set<string>();
  for (const file of codeFiles) {
    for (const part of file.split(/[\\/]/)) stems.add(part.replace(/\.[^.]+$/, '').toLowerCase());
  }
  return names.filter((name) => !provided.has(name) && !nameVariants(name).some((variant) => stems.has(variant)));
}

/**
 * Компоненты реестра, которые стек даёт сам: проекту на Nuxt UI не нужны
 * свои `Button` и `Card` — это `UButton` и `UCard`. Для остальных стеков
 * библиотека обязательных компонентов не закрывает, и они ищутся в коде.
 */
export const STACK_PROVIDES: Readonly<Record<StackId, readonly string[]>> = {
  'nuxt-ui': ['TopBar', 'Card', 'Button', 'Field', 'Pill', 'Progress', 'Empty'],
  expo: [],
  compose: [],
  swiftui: []
};

export function providedComponents(stacks: readonly { id: StackId }[] | undefined): Set<string> {
  return new Set((stacks ?? []).flatMap((stack) => STACK_PROVIDES[stack.id]));
}
