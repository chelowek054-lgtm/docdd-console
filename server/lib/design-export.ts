import type { DesignTokens, Palette } from './design';

/**
 * Выгрузка токенов в файлы темы четырёх стеков (docs/16-design-system.md, «Выгрузка в
 * стеки»). Чистые функции: тот же вход даёт тот же текст, поэтому расхождение с файлом
 * проекта — это расхождение с токенами, а не с настроением выгрузки.
 */

export type Stack = 'nuxt-ui' | 'expo' | 'compose' | 'swiftui';
export const STACKS: readonly Stack[] = ['nuxt-ui', 'expo', 'compose', 'swiftui'];

export interface ExportFile {
  /** Путь от корня проекта. */
  path: string;
  text: string;
}

/** Пути по умолчанию; манифест проекта их переопределяет (`design.stacks[].files`). */
export const DEFAULT_FILES: Record<Stack, Record<string, string>> = {
  'nuxt-ui': { css: 'app/assets/css/main.css', config: 'app/app.config.ts' },
  expo: { theme: 'constants/theme.ts' },
  compose: { dir: 'app/src/main/java/ui/theme' },
  swiftui: { theme: 'Sources/Theme/Theme.swift', assets: 'Resources/Colors.xcassets' }
};

const ROLES_ORDER = ['bg', 'surface', 'surfaceAlt', 'ink', 'muted', 'line', 'accent', 'onAccent', 'core', 'ok', 'warn', 'danger', 'onDanger'];

/** Роли в стабильном порядке: сперва известные, затем остальные по алфавиту. */
function rolesOf(tokens: DesignTokens): string[] {
  const all = new Set([...Object.keys(tokens.palette.light), ...Object.keys(tokens.palette.dark)]);
  const known = ROLES_ORDER.filter((role) => all.has(role));
  const extra = [...all].filter((role) => !ROLES_ORDER.includes(role)).sort();
  return [...known, ...extra];
}

const colorOf = (palette: Palette, role: string): string => palette[role] ?? '#000000';
const kebab = (name: string) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);
const pascal = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);
const entries = (record: Record<string, number>, order: readonly string[]): [string, number][] => {
  const known = order.filter((name) => record[name] !== undefined).map((name): [string, number] => [name, record[name] as number]);
  const extra = Object.keys(record).filter((name) => !order.includes(name)).sort().map((name): [string, number] => [name, record[name] as number]);
  return [...known, ...extra];
};
const TYPE_ORDER = ['caption', 'small', 'body', 'lead', 'title', 'display'];
const SPACE_ORDER = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'];
const RADII_ORDER = ['sm', 'md', 'pill'];

const HEADER = 'Сгенерировано консолью DocDD из токенов дизайна (docs/16-design-system.md). Не править руками: правится запись design в источнике.';

function exportNuxtUi(tokens: DesignTokens, files: Record<string, string>): ExportFile[] {
  const roles = rolesOf(tokens);
  const block = (selector: string, palette: Palette) => [
    `${selector} {`,
    ...roles.map((role) => `  --ds-${kebab(role)}: ${colorOf(palette, role)};`),
    '',
    '  /* Семантические переменные Nuxt UI берут роли токенов. */',
    '  --ui-bg: var(--ds-bg);',
    '  --ui-bg-elevated: var(--ds-surface);',
    '  --ui-bg-muted: var(--ds-surface-alt);',
    '  --ui-text: var(--ds-ink);',
    '  --ui-text-muted: var(--ds-muted);',
    '  --ui-border: var(--ds-line);',
    '  --ui-primary: var(--ds-accent);',
    '}'
  ].join('\n');
  const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
  const scale = (name: string, role: string) => shades.map((shade) => `  --color-${name}-${shade}: var(--ds-${kebab(role)});`).join('\n');
  const css = [
    `/* ${HEADER} */`,
    '@theme {',
    '  /* Токен — один цвет роли, поэтому шкала Nuxt UI у цвета плоская. */',
    scale('accent', 'accent'),
    scale('danger', 'danger'),
    scale('ok', 'ok'),
    scale('warn', 'warn'),
    '}',
    '',
    block(':root', tokens.palette.light),
    '',
    block('.dark', tokens.palette.dark),
    '',
    ':root {',
    ...entries(tokens.spacing, SPACE_ORDER).map(([name, value]) => `  --ds-space-${name}: ${value / 16}rem;`),
    ...entries(tokens.radii, RADII_ORDER).map(([name, value]) => `  --ds-radius-${name}: ${value >= 999 ? '999px' : `${value / 16}rem`};`),
    ...entries(tokens.typography, TYPE_ORDER).map(([name, value]) => `  --ds-font-${name}: ${value / 16}rem;`),
    `  --ui-radius: var(--ds-radius-md);`,
    '}',
    ''
  ].join('\n');
  const config = [
    `// ${HEADER}`,
    'export default defineAppConfig({',
    '  ui: {',
    '    colors: { primary: \'accent\', error: \'danger\', success: \'ok\', warning: \'warn\' }',
    '  }',
    '});',
    ''
  ].join('\n');
  return [
    { path: files['css'] ?? DEFAULT_FILES['nuxt-ui']['css'] as string, text: css },
    { path: files['config'] ?? DEFAULT_FILES['nuxt-ui']['config'] as string, text: config }
  ];
}

function exportExpo(tokens: DesignTokens, files: Record<string, string>): ExportFile[] {
  const roles = rolesOf(tokens);
  const colors = (name: string, palette: Palette) => [`export const ${name} = {`, ...roles.map((role) => `  ${role}: '${colorOf(palette, role)}',`), '} as const;'].join('\n');
  const record = (name: string, values: [string, number][]) => [`export const ${name} = {`, ...values.map(([key, value]) => `  ${key}: ${value},`), '} as const;'].join('\n');
  const text = [
    `// ${HEADER}`,
    "import { useColorScheme } from 'react-native';",
    '',
    colors('LightColors', tokens.palette.light),
    '',
    colors('DarkColors', tokens.palette.dark),
    '',
    record('spacing', entries(tokens.spacing, SPACE_ORDER)),
    '',
    record('radii', entries(tokens.radii, RADII_ORDER)),
    '',
    record('typography', entries(tokens.typography, TYPE_ORDER)),
    '',
    'export type ThemeColors = typeof LightColors | typeof DarkColors;',
    '',
    '/** Палитра по теме системы. */',
    'export function useColors(): ThemeColors {',
    "  return useColorScheme() === 'dark' ? DarkColors : LightColors;",
    '}',
    ''
  ].join('\n');
  return [{ path: files['theme'] ?? DEFAULT_FILES.expo['theme'] as string, text }];
}

function kotlinColor(value: string): string {
  const hex = value.replace('#', '').toUpperCase();
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  return `Color(0xFF${full})`;
}

function exportCompose(tokens: DesignTokens, files: Record<string, string>): ExportFile[] {
  const dir = (files['dir'] ?? DEFAULT_FILES.compose['dir'] as string).replace(/\/$/, '');
  const roles = rolesOf(tokens);
  const scheme = (name: string, call: string, palette: Palette) => {
    const c = (role: string) => kotlinColor(colorOf(palette, role));
    return [
      `val ${name} = ${call}(`,
      `    primary = ${c('accent')},`,
      `    onPrimary = ${c('onAccent')},`,
      `    background = ${c('bg')},`,
      `    onBackground = ${c('ink')},`,
      `    surface = ${c('surface')},`,
      `    onSurface = ${c('ink')},`,
      `    surfaceVariant = ${c('surfaceAlt')},`,
      `    onSurfaceVariant = ${c('muted')},`,
      `    outline = ${c('line')},`,
      `    error = ${c('danger')},`,
      `    onError = ${c('onDanger')}`,
      ')'
    ].join('\n');
  };
  const extra = (name: string, palette: Palette) => [`val ${name} = AppColors(`, ...roles.map((role, at) => `    ${role} = ${kotlinColor(colorOf(palette, role))}${at < roles.length - 1 ? ',' : ''}`), ')'].join('\n');
  const color = [
    `// ${HEADER}`,
    'package ui.theme',
    '',
    'import androidx.compose.material3.darkColorScheme',
    'import androidx.compose.material3.lightColorScheme',
    'import androidx.compose.ui.graphics.Color',
    '',
    '/** Роли токенов целиком: то, чему нет места в схеме Material (core, ok, warn…), берётся отсюда. */',
    'data class AppColors(',
    ...roles.map((role, at) => `    val ${role}: Color${at < roles.length - 1 ? ',' : ''}`),
    ')',
    '',
    scheme('LightColorScheme', 'lightColorScheme', tokens.palette.light),
    '',
    scheme('DarkColorScheme', 'darkColorScheme', tokens.palette.dark),
    '',
    extra('LightAppColors', tokens.palette.light),
    '',
    extra('DarkAppColors', tokens.palette.dark),
    ''
  ].join('\n');
  const type = [
    `// ${HEADER}`,
    'package ui.theme',
    '',
    'import androidx.compose.ui.text.TextStyle',
    'import androidx.compose.ui.unit.sp',
    '',
    'object AppTypography {',
    ...entries(tokens.typography, TYPE_ORDER).map(([name, value]) => `    val ${name} = TextStyle(fontSize = ${value}.sp)`),
    '}',
    ''
  ].join('\n');
  const shape = [
    `// ${HEADER}`,
    'package ui.theme',
    '',
    'import androidx.compose.foundation.shape.RoundedCornerShape',
    'import androidx.compose.material3.Shapes',
    'import androidx.compose.ui.unit.dp',
    '',
    'object Radii {',
    ...entries(tokens.radii, RADII_ORDER).map(([name, value]) => `    val ${name} = ${value}.dp`),
    '}',
    '',
    'object Spacing {',
    ...entries(tokens.spacing, SPACE_ORDER).map(([name, value]) => `    val ${name} = ${value}.dp`),
    '}',
    '',
    'val AppShapes = Shapes(',
    `    small = RoundedCornerShape(Radii.${tokens.radii['sm'] !== undefined ? 'sm' : Object.keys(tokens.radii)[0] ?? 'sm'}),`,
    `    medium = RoundedCornerShape(Radii.${tokens.radii['md'] !== undefined ? 'md' : Object.keys(tokens.radii)[0] ?? 'md'})`,
    ')',
    ''
  ].join('\n');
  const theme = [
    `// ${HEADER}`,
    'package ui.theme',
    '',
    'import androidx.compose.foundation.isSystemInDarkTheme',
    'import androidx.compose.material3.MaterialTheme',
    'import androidx.compose.runtime.Composable',
    '',
    '@Composable',
    'fun AppTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {',
    '    MaterialTheme(',
    '        colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,',
    '        shapes = AppShapes,',
    '        content = content',
    '    )',
    '}',
    ''
  ].join('\n');
  return [
    { path: `${dir}/Color.kt`, text: color },
    { path: `${dir}/Type.kt`, text: type },
    { path: `${dir}/Shape.kt`, text: shape },
    { path: `${dir}/Theme.kt`, text: theme }
  ];
}

function swiftComponents(value: string): { red: string; green: string; blue: string } {
  const hex = value.replace('#', '');
  const full = hex.length === 3 ? [...hex].map((char) => char + char).join('') : hex;
  const part = (from: number) => (parseInt(full.slice(from, from + 2), 16) / 255).toFixed(3);
  return { red: part(0), green: part(2), blue: part(4) };
}

function exportSwiftUi(tokens: DesignTokens, files: Record<string, string>): ExportFile[] {
  const roles = rolesOf(tokens);
  const assets = (files['assets'] ?? DEFAULT_FILES.swiftui['assets'] as string).replace(/\/$/, '');
  const theme = [
    `// ${HEADER}`,
    'import SwiftUI',
    '',
    'enum Theme {',
    '    // Цвета — в каталоге ассетов с вариантами Any/Dark: тему подбирает система.',
    ...roles.map((role) => `    static let ${role} = Color("${role}")`),
    '',
    '    static let spacing = (',
    `        ${entries(tokens.spacing, SPACE_ORDER).map(([name, value]) => `${name}: CGFloat(${value})`).join(',\n        ')}`,
    '    )',
    '',
    '    static let radii = (',
    `        ${entries(tokens.radii, RADII_ORDER).map(([name, value]) => `${name}: CGFloat(${value})`).join(',\n        ')}`,
    '    )',
    '}',
    '',
    'extension Font {',
    ...entries(tokens.typography, TYPE_ORDER).map(([name, value]) => `    static let app${pascal(name)} = Font.system(size: ${value})`),
    '}',
    ''
  ].join('\n');
  const colorset = (role: string) => {
    const entry = (palette: Palette, dark: boolean) => {
      const c = swiftComponents(colorOf(palette, role));
      return {
        ...(dark ? { appearances: [{ appearance: 'luminosity', value: 'dark' }] } : {}),
        color: { 'color-space': 'srgb', components: { alpha: '1.000', blue: c.blue, green: c.green, red: c.red } },
        idiom: 'universal'
      };
    };
    return `${JSON.stringify({ colors: [entry(tokens.palette.light, false), entry(tokens.palette.dark, true)], info: { author: 'xcode', version: 1 } }, null, 2)}\n`;
  };
  return [
    { path: files['theme'] ?? DEFAULT_FILES.swiftui['theme'] as string, text: theme },
    ...roles.map((role) => ({ path: `${assets}/${role}.colorset/Contents.json`, text: colorset(role) }))
  ];
}

export function exportStack(stack: Stack, tokens: DesignTokens, files: Record<string, string> = {}): ExportFile[] {
  switch (stack) {
    case 'nuxt-ui': return exportNuxtUi(tokens, files);
    case 'expo': return exportExpo(tokens, files);
    case 'compose': return exportCompose(tokens, files);
    case 'swiftui': return exportSwiftUi(tokens, files);
  }
}

export function isStack(value: unknown): value is Stack {
  return typeof value === 'string' && (STACKS as readonly string[]).includes(value);
}

/** Построчный дифф для показа расхождения: минус — что в файле проекта, плюс — что даст выгрузка. */
export function lineDiff(current: string | null, expected: string): string[] {
  const a = (current ?? '').replace(/\r\n/g, '\n').split('\n');
  const b = expected.replace(/\r\n/g, '\n').split('\n');
  // Наибольшая общая подпоследовательность: файлы темы короткие, квадратичная таблица дешёвая.
  const table: number[][] = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i]![j] = a[i] === b[j] ? (table[i + 1]![j + 1] ?? 0) + 1 : Math.max(table[i + 1]![j] ?? 0, table[i]![j + 1] ?? 0);
    }
  }
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; } else if ((table[i + 1]![j] ?? 0) >= (table[i]![j + 1] ?? 0)) out.push(`- ${a[i++]}`);
    else out.push(`+ ${b[j++]}`);
  }
  while (i < a.length) out.push(`- ${a[i++]}`);
  while (j < b.length) out.push(`+ ${b[j++]}`);
  return out;
}
