import {
  COMPONENT_NAMES,
  PALETTE_ROLES,
  RADIUS_NAMES,
  SPACING_NAMES,
  TYPOGRAPHY_NAMES,
  type DesignTheme,
  type PlainTokens
} from './design';

/**
 * Выгрузка токенов дизайна в файлы темы четырёх стеков (docs/16-design-system.md,
 * «Стеки и выгрузка») и сверка файла проекта с тем, что дала бы выгрузка.
 * Чистые функции: одинаковый вход — одинаковый текст, поэтому тесты держат
 * выгрузку снимками. Приложение ничего не пишет в проект (ADR-0022): текст
 * показывается, а файл меняет задача модели в своей ветке.
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

const HEADER = 'Сгенерировано консолью DocDD из токенов дизайна (docs/16-design-system.md). Не правьте руками: меняются токены.';

/* ---------- общие помощники ---------- */

/** Имена в порядке: сперва обязательные, как в эталоне, потом остальные по алфавиту. */
function ordered(bag: Record<string, unknown>, required: readonly string[]): string[] {
  const first = required.filter((name) => name in bag);
  const rest = Object.keys(bag).filter((name) => !required.includes(name)).sort();
  return [...first, ...rest];
}

const rolesOf = (palette: Record<string, string>) => ordered(palette, PALETTE_ROLES);
const roleNames = (tokens: PlainTokens) => [...new Set([...rolesOf(tokens.palette.light), ...rolesOf(tokens.palette.dark)])];

/** `#RRGGBB` без прозрачности и `#RRGGBBAA` с ней — раздельно. */
function channels(color: string): { r: number; g: number; b: number; a: number } {
  const hex = color.slice(1);
  const at = (index: number) => parseInt(hex.slice(index, index + 2), 16);
  return { r: at(0), g: at(2), b: at(4), a: hex.length === 8 ? at(6) : 255 };
}

const upperHex = (value: number) => value.toString(16).padStart(2, '0').toUpperCase();

const cssName = (role: string) => role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const pascal = (role: string) => role.charAt(0).toUpperCase() + role.slice(1);

const lines = (...parts: string[]) => `${parts.join('\n')}\n`;

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
  warn: ['--ui-warning'],
  danger: ['--ui-error']
};

function nuxtCss(tokens: PlainTokens): string {
  const block = (theme: DesignTheme, selector: string): string[] => {
    const palette = tokens.palette[theme];
    const out: string[] = [`${selector} {`];
    for (const role of rolesOf(palette)) {
      out.push(`  --ds-color-${cssName(role)}: ${palette[role]};`);
    }
    for (const role of rolesOf(palette)) {
      for (const name of NUXT_UI_MAP[role] ?? []) out.push(`  ${name}: ${palette[role]};`);
    }
    out.push('}');
    return out;
  };

  const scale = (prefix: string, bag: Record<string, number>, required: readonly string[]): string[] =>
    ordered(bag, required).map((name) => `  --ds-${prefix}-${cssName(name)}: ${bag[name]}px;`);

  const typography: string[] = [];
  for (const name of ordered(tokens.typography, TYPOGRAPHY_NAMES)) {
    const token = tokens.typography[name]!;
    typography.push(`  --ds-font-${cssName(name)}: ${token.size}px;`);
    if (token.line !== undefined) typography.push(`  --ds-line-${cssName(name)}: ${token.line}px;`);
    if (token.weight !== undefined) typography.push(`  --ds-weight-${cssName(name)}: ${token.weight};`);
  }

  return lines(
    `/* ${REGION_START} — ${HEADER} */`,
    ':root {',
    ...scale('space', tokens.spacing, SPACING_NAMES),
    ...scale('radius', tokens.radius, RADIUS_NAMES),
    ...typography,
    '}',
    '',
    ...block('light', ':root'),
    '',
    ...block('dark', '.dark'),
    `/* ${REGION_END} */`
  );
}

function nuxtTokensTs(tokens: PlainTokens): string {
  const plain = {
    spacing: tokens.spacing,
    radius: tokens.radius,
    typography: tokens.typography,
    palette: tokens.palette
  };
  return lines(
    `// ${HEADER}`,
    '',
    `export const designTokens = ${JSON.stringify(plain, null, 2).replace(/"([A-Za-z_$][\w$]*)":/g, '$1:').replace(/"/g, "'")} as const;`,
    '',
    'export type DesignTokens = typeof designTokens;'
  );
}

/* ---------- Expo ---------- */

function expoTheme(tokens: PlainTokens): string {
  const colors = (name: string, theme: DesignTheme) => [
    `export const ${name} = {`,
    ...rolesOf(tokens.palette[theme]).map((role) => `  ${role}: '${tokens.palette[theme][role]}',`),
    '} as const;'
  ];
  const typography = ordered(tokens.typography, TYPOGRAPHY_NAMES).map((name) => {
    const token = tokens.typography[name]!;
    const parts = [`fontSize: ${token.size}`];
    if (token.line !== undefined) parts.push(`lineHeight: ${token.line}`);
    if (token.weight !== undefined) parts.push(`fontWeight: '${token.weight}'`);
    return `  ${name}: { ${parts.join(', ')} },`;
  });
  const numbers = (name: string, bag: Record<string, number>, required: readonly string[]) => [
    `export const ${name} = {`,
    ...ordered(bag, required).map((key) => `  ${key}: ${bag[key]},`),
    '} as const;'
  ];

  return lines(
    `// ${HEADER}`,
    "import { useColorScheme } from 'react-native';",
    '',
    ...colors('LightColors', 'light'),
    '',
    ...colors('DarkColors', 'dark'),
    '',
    'export type ThemeColors = typeof LightColors;',
    '',
    ...numbers('spacing', tokens.spacing, SPACING_NAMES),
    '',
    ...numbers('radius', tokens.radius, RADIUS_NAMES),
    '',
    'export const typography = {',
    ...typography,
    '} as const;',
    '',
    '/** Палитра по системной теме; `null` из `useColorScheme()` — светлая. */',
    'export function useThemeColors(): ThemeColors {',
    "  return useColorScheme() === 'dark' ? DarkColors : LightColors;",
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

const COMPOSE_EXTRA = ['core', 'ok', 'warn'] as const;

function composePackage(options: ExportOptions): string {
  return options.package && options.package.trim() !== '' ? options.package.trim() : 'ui.theme';
}

function composeColor(tokens: PlainTokens, options: ExportOptions): string {
  const out: string[] = [
    `// ${HEADER}`,
    `package ${composePackage(options)}`,
    '',
    'import androidx.compose.material3.ColorScheme',
    'import androidx.compose.material3.darkColorScheme',
    'import androidx.compose.material3.lightColorScheme',
    'import androidx.compose.ui.graphics.Color',
    ''
  ];
  for (const theme of ['light', 'dark'] as const) {
    const prefix = pascal(theme);
    const palette = tokens.palette[theme];
    for (const role of rolesOf(palette)) out.push(`val ${prefix}${pascal(role)} = ${kotlinColor(palette[role]!)}`);
    out.push('');
  }
  const scheme = (theme: DesignTheme) => {
    const prefix = pascal(theme);
    const palette = tokens.palette[theme];
    return COMPOSE_SCHEME.filter(([, role]) => role in palette)
      .map(([param, role]) => `    ${param} = ${prefix}${pascal(role)},`);
  };
  out.push('val LightColorScheme: ColorScheme = lightColorScheme(', ...scheme('light'), ')', '');
  out.push('val DarkColorScheme: ColorScheme = darkColorScheme(', ...scheme('dark'), ')', '');
  out.push('/** Роли, которых нет в Material 3: смысловой цвет ядра и состояния. */');
  out.push('data class AppExtraColors(val core: Color, val ok: Color, val warn: Color)', '');
  for (const theme of ['light', 'dark'] as const) {
    const prefix = pascal(theme);
    const palette = tokens.palette[theme];
    const args = COMPOSE_EXTRA.filter((role) => role in palette).map((role) => `${role} = ${prefix}${pascal(role)}`);
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
      const parts = [`fontSize = ${token.size}.sp`];
      if (token.line !== undefined) parts.push(`lineHeight = ${token.line}.sp`);
      if (token.weight !== undefined) parts.push(`fontWeight = FontWeight.W${token.weight}`);
      return `    ${style} = TextStyle(${parts.join(', ')}),`;
    });
  return lines(
    `// ${HEADER}`,
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
  const radius = (name: string) => `${tokens.radius[name] ?? 0}.dp`;
  return lines(
    `// ${HEADER}`,
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
  const spacing = ordered(tokens.spacing, SPACING_NAMES).map((name) => `    val ${name} = ${tokens.spacing[name]}.dp`);
  return lines(
    `// ${HEADER}`,
    `package ${composePackage(options)}`,
    '',
    'import androidx.compose.foundation.isSystemInDarkTheme',
    'import androidx.compose.material3.MaterialTheme',
    'import androidx.compose.runtime.Composable',
    'import androidx.compose.runtime.CompositionLocalProvider',
    'import androidx.compose.runtime.staticCompositionLocalOf',
    'import androidx.compose.ui.unit.dp',
    '',
    'val LocalExtraColors = staticCompositionLocalOf { LightExtraColors }',
    '',
    'object AppSpacing {',
    ...spacing,
    '}',
    '',
    '@Composable',
    'fun AppTheme(darkTheme: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {',
    '    CompositionLocalProvider(LocalExtraColors provides if (darkTheme) DarkExtraColors else LightExtraColors) {',
    '        MaterialTheme(',
    '            colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme,',
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
  const numbers = (name: string, bag: Record<string, number>, required: readonly string[]) => [
    `    enum ${name} {`,
    ...ordered(bag, required).map((key) => `        static let ${key}: CGFloat = ${bag[key]}`),
    '    }'
  ];
  const fonts = ordered(tokens.typography, TYPOGRAPHY_NAMES).map((name) => {
    const token = tokens.typography[name]!;
    const weight = SWIFT_WEIGHT[token.weight ?? 400] ?? 'regular';
    return `        static let ${name} = Font.system(size: ${token.size}, weight: .${weight})`;
  });
  const colors = roleNames(tokens).map((role) => `        static let ${role} = SwiftUI.Color("${role}")`);

  return lines(
    `// ${HEADER}`,
    'import SwiftUI',
    '',
    '/// Цвета берутся из каталога ассетов: у каждой роли варианты Any и Dark.',
    'enum AppTheme {',
    '    enum Colors {',
    ...colors,
    '    }',
    '',
    ...numbers('Spacing', tokens.spacing, SPACING_NAMES),
    '',
    ...numbers('Radius', tokens.radius, RADIUS_NAMES),
    '',
    '    enum Typography {',
    ...fonts,
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
          // Цвета каталога: ключ `colors:<роль>`, путь строится от каталога `colors` манифеста.
          ...roleNames(tokens).map((role) => ({
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

/** Компоненты из реестра нужны проекту: имя ищется в именах исходных файлов и модулей. */
export function requiredComponents(tokens: PlainTokens): string[] {
  const names = tokens.components.map((component) => component.name);
  return names.length > 0 ? names : [...COMPONENT_NAMES];
}

/* ---------- пути и компоненты проекта ---------- */

/** Путь только внутри проекта: без абсолютного пути и без `..`. */
export function isSafeRelative(path: string): boolean {
  if (path === '' || /^([a-zA-Z]:|[\/])/.test(path)) return false;
  return !path.split(/[\/]/).includes('..');
}

/**
 * Где файл лежит в проекте: путь из манифеста, иначе умолчание стека. Цвета
 * каталога ассетов SwiftUI строятся от каталога `colors`.
 */
export function projectFilePath(files: Record<string, string> | undefined, file: ExportFile): string {
  if (file.key.startsWith('colors:')) {
    const directory = files?.['colors'] ?? 'Assets.xcassets';
    return `${directory.replace(/[\/]+$/, '')}/${file.key.slice('colors:'.length)}.colorset/Contents.json`;
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
    for (const part of file.split(/[\/]/)) stems.add(part.replace(/\.[^.]+$/, '').toLowerCase());
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
