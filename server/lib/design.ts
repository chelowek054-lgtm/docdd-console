/**
 * Токены дизайна (docs/16-design-system.md, ADR-0022, ADR-0023): разбор блоков
 * `docdd-design` из подтверждённых `decision`/`design`, сложение «общее →
 * локальное» с источником у каждой части и проверки — контраст по WCAG, полнота
 * тем, шкал и сетки, i18n, противоречие блоков. Чистые функции над текстом
 * записей: ни файловой системы, ни Nuxt — их можно проверять без сервера.
 *
 * Читает записи тем же способом, что `practice-rules.ts` читает `docdd-rules`:
 * источник приходит снаружи (`RuleRecord` с меткой проекта-источника), а сам
 * разбор об источниках ничего не знает.
 *
 * Размеры — только `rem`: блок обязан назвать единицу, иначе значения
 * прочитались бы как пиксели и разошлись бы в шестнадцать раз.
 */

export interface DesignRecord {
  id: string;
  /** Метка проекта-источника у общих практик; у локальных её нет. */
  label?: string | undefined;
  body: string;
}

export type DesignLevel = 'general' | 'local';
/** Базовая тема: светлая или тёмная — обязательные, от них наследуются остальные. */
export type BaseTheme = 'light' | 'dark';
/** Имя темы: базовая или добавленная проектом (`ocean`, `contrast`…). */
export type DesignTheme = string;

export const BASE_THEMES: readonly BaseTheme[] = ['light', 'dark'];
/** Прежнее имя: «обязательные темы». Оставлено, чтобы не ломать читателей. */
export const DESIGN_THEMES = BASE_THEMES;

/** Обязательные имена: минимум эталона, по сложенному результату (docs/16-design-system.md, «Словарь»). */
export const TYPOGRAPHY_NAMES = ['caption', 'small', 'body', 'lead', 'title', 'display'] as const;
export const SPACING_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;
export const RADIUS_NAMES = ['sm', 'md', 'pill'] as const;
export const PALETTE_ROLES = [
  'bg', 'surface', 'surfaceAlt', 'ink', 'muted', 'line', 'accent', 'onAccent', 'core', 'ok', 'warn', 'danger', 'onDanger'
] as const;
export const COMPONENT_NAMES = ['TopBar', 'Card', 'Button', 'Field', 'Pill', 'Progress', 'Empty'] as const;
export const BREAKPOINT_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;
export const CONTAINER_NAMES = ['sm', 'md', 'lg', 'xl', 'xxl'] as const;

/** Пары «текст/фон», для которых держим контраст не ниже порога (R-0031). */
export const CONTRAST_PAIRS: readonly (readonly [string, string])[] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'bg'],
  ['onAccent', 'accent'],
  ['onDanger', 'danger']
];

export const MIN_CONTRAST = 4.5;

/** Пикселей в `1rem` по умолчанию: размер шрифта корня браузера. */
export const DEFAULT_ROOT = 16;

/** Образец — Bootstrap 5 в rem; нужен выгрузке, пока блок сетку не назвал (проверка об этом скажет). */
export const DEFAULT_GRID = {
  columns: 12,
  gutter: 1.5,
  breakpoints: { xs: 0, sm: 36, md: 48, lg: 62, xl: 75, xxl: 87.5 } as Record<string, number>,
  containers: { sm: 33.75, md: 45, lg: 60, xl: 71.25, xxl: 82.5 } as Record<string, number>
};

/** Язык, без которого i18n не считается: словари читают все. */
export const REQUIRED_LOCALE = 'en';
export const MIN_LOCALES = 2;

const THEME_NAME = /^[a-z][a-z0-9-]*$/;
const LOCALE = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export interface TypographyToken {
  /** Размер в `rem`. */
  size: number;
  /** Интерлиньяж в `rem`. */
  line?: number;
  weight?: number;
}

export interface DesignComponent {
  name: string;
  summary?: string;
}

/** Часть токенов с происхождением: запись, которая её задала, и перекрытые ею. */
export interface Sourced<T> {
  value: T;
  source: string;
  level: DesignLevel;
  overrides: string[];
}

/** Тема сверх светлой и тёмной: база и только переопределённые роли. */
export interface ThemeToken {
  mode: Sourced<BaseTheme>;
  label: Sourced<string> | null;
  colors: Record<string, Sourced<string>>;
}

export interface DesignTokens {
  /** Пикселей в `1rem` для платформ без rem; `null` — не названо, действует 16. */
  root: Sourced<number> | null;
  principles: Sourced<string>[];
  typography: Record<string, Sourced<TypographyToken>>;
  spacing: Record<string, Sourced<number>>;
  radius: Record<string, Sourced<number>>;
  grid: {
    columns: Sourced<number> | null;
    gutter: Sourced<number> | null;
    breakpoints: Record<string, Sourced<number>>;
    containers: Record<string, Sourced<number>>;
  };
  /** Базовые темы: светлая и тёмная, полная палитра. */
  palette: Record<BaseTheme, Record<string, Sourced<string>>>;
  /** Дополнительные темы поверх базовых. */
  themes: Record<string, ThemeToken>;
  i18n: {
    default: Sourced<string> | null;
    fallback: Sourced<string> | null;
    locales: Sourced<string>[];
  };
  components: Sourced<DesignComponent>[];
  /** Незнакомые ключи блока сохраняются как есть: проект вправе добавить своё. */
  extra: Record<string, Sourced<unknown>>;
}

export type DesignCheckCode =
  | 'design_block_invalid'
  | 'design_conflict'
  | 'design_scale_gap'
  | 'design_theme_incomplete'
  | 'design_contrast_low'
  | 'design_i18n_missing';

export interface DesignCheck {
  code: DesignCheckCode;
  message: string;
  /** Запись, к которой нарушение относится; `null` — к сложенному результату целиком. */
  source: string | null;
  theme?: DesignTheme;
  pair?: [string, string];
  ratio?: number;
  /** Каких имён не хватает. */
  names?: string[];
}

export interface ContrastRow {
  theme: DesignTheme;
  pair: [string, string];
  ratio: number;
  ok: boolean;
  /** Цвета, как они пошли в расчёт (прозрачный текст уже лежит на фоне). */
  fg: string;
  bg: string;
}

export interface DesignResolution {
  tokens: DesignTokens;
  checks: DesignCheck[];
  contrast: ContrastRow[];
  conflicts: { key: string; records: string[] }[];
  problems: { record: string; message: string }[];
  sources: { id: string; level: DesignLevel }[];
  /** Ни одного блока: дизайна нет, и проверять нечего. */
  empty: boolean;
}

const BLOCK = /```docdd-design\s*\n([\s\S]*?)```/g;
const COLOR = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

interface ParsedBlock {
  root: number | null;
  principles: string[];
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  grid: {
    columns: number | null;
    gutter: number | null;
    breakpoints: Record<string, number>;
    containers: Record<string, number>;
  };
  palette: Record<BaseTheme, Record<string, string>>;
  themes: Record<string, { mode: BaseTheme; label: string | null; palette: Record<string, string> }>;
  i18n: { default: string | null; fallback: string | null; locales: string[] };
  components: DesignComponent[];
  overrides: string[];
  extra: Record<string, unknown>;
}

const KNOWN_KEYS = new Set([
  'unit', 'root', 'principles', 'typography', 'spacing', 'radius', 'grid', 'palette', 'themes', 'i18n', 'components', 'overrides'
]);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const label = (record: DesignRecord) => (record.label ? `[${record.label}] ${record.id}` : record.id);

function emptyBlock(): ParsedBlock {
  return {
    root: null,
    principles: [],
    typography: {},
    spacing: {},
    radius: {},
    grid: { columns: null, gutter: null, breakpoints: {}, containers: {} },
    palette: { light: {}, dark: {} },
    themes: {},
    i18n: { default: null, fallback: null, locales: [] },
    components: [],
    overrides: [],
    extra: {}
  };
}

function numeric(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Блоки записи; не разобравшийся блок — в `problems`, остальные идут дальше. */
export function parseDesignBlocks(record: DesignRecord): { blocks: ParsedBlock[]; problems: { record: string; message: string }[] } {
  const blocks: ParsedBlock[] = [];
  const problems: { record: string; message: string }[] = [];
  const bad = (message: string) => problems.push({ record: record.id, message: `Блок \`docdd-design\`: ${message}` });

  for (const match of record.body.matchAll(BLOCK)) {
    let raw: unknown;
    try {
      raw = JSON.parse(match[1] ?? '');
    } catch (error) {
      bad(`не разобран — ${error instanceof Error ? error.message : String(error)}.`);
      continue;
    }
    if (!isObject(raw)) {
      bad('должен быть объектом.');
      continue;
    }
    // Без единицы значения читались бы как пиксели: блок не принимается целиком.
    if (raw['unit'] !== 'rem') {
      bad(raw['unit'] === undefined
        ? 'нет `"unit": "rem"`: размеры задаются в rem, без названной единицы блок не принимается.'
        : `единица \`${String(raw['unit'])}\` не поддерживается: только \`rem\`.`);
      continue;
    }

    const block = emptyBlock();

    if (raw['root'] !== undefined) {
      const root = numeric(raw['root']);
      if (root === null || root === 0) bad('`root` — положительное число пикселей в 1rem.');
      else block.root = root;
    }

    if (raw['principles'] !== undefined) {
      if (Array.isArray(raw['principles'])) {
        for (const item of raw['principles']) {
          if (typeof item === 'string' && item.trim() !== '') block.principles.push(item.trim());
          else bad('принцип в `principles` должен быть непустой строкой.');
        }
      } else bad('`principles` должен быть списком строк.');
    }

    if (isObject(raw['typography'])) {
      for (const [name, item] of Object.entries(raw['typography'])) {
        const size = isObject(item) ? numeric(item['size']) : null;
        if (!isObject(item) || size === null || size === 0) {
          bad(`у кегля \`${name}\` нужен положительный \`size\` в rem.`);
          continue;
        }
        const token: TypographyToken = { size };
        const line = numeric(item['line']);
        const weight = numeric(item['weight']);
        if (item['line'] !== undefined && line === null) bad(`у кегля \`${name}\` \`line\` — неотрицательное число в rem.`);
        if (item['weight'] !== undefined && weight === null) bad(`у кегля \`${name}\` \`weight\` — неотрицательное число.`);
        if (line !== null) token.line = line;
        if (weight !== null) token.weight = weight;
        block.typography[name] = token;
      }
    } else if (raw['typography'] !== undefined) bad('`typography` должен быть объектом.');

    for (const key of ['spacing', 'radius'] as const) {
      const part = raw[key];
      if (part === undefined) continue;
      if (!isObject(part)) {
        bad(`\`${key}\` должен быть объектом.`);
        continue;
      }
      for (const [name, item] of Object.entries(part)) {
        const value = numeric(item);
        if (value === null) bad(`в \`${key}.${name}\` нужно неотрицательное число в rem.`);
        else block[key][name] = value;
      }
    }

    if (isObject(raw['grid'])) {
      const grid = raw['grid'];
      if (grid['columns'] !== undefined) {
        const columns = numeric(grid['columns']);
        if (columns === null || !Number.isInteger(columns) || columns < 1) bad('`grid.columns` — целое от 1.');
        else block.grid.columns = columns;
      }
      if (grid['gutter'] !== undefined) {
        const gutter = numeric(grid['gutter']);
        if (gutter === null) bad('`grid.gutter` — неотрицательное число в rem.');
        else block.grid.gutter = gutter;
      }
      for (const key of ['breakpoints', 'containers'] as const) {
        const part = grid[key];
        if (part === undefined) continue;
        if (!isObject(part)) {
          bad(`\`grid.${key}\` должен быть объектом.`);
          continue;
        }
        for (const [name, item] of Object.entries(part)) {
          const value = numeric(item);
          if (value === null) bad(`в \`grid.${key}.${name}\` нужно неотрицательное число в rem.`);
          else block.grid[key][name] = value;
        }
      }
    } else if (raw['grid'] !== undefined) bad('`grid` должен быть объектом.');

    if (isObject(raw['palette'])) {
      for (const theme of BASE_THEMES) {
        const part = raw['palette'][theme];
        if (part === undefined) continue;
        if (!isObject(part)) {
          bad(`\`palette.${theme}\` должен быть объектом.`);
          continue;
        }
        for (const [role, color] of Object.entries(part)) {
          if (typeof color === 'string' && COLOR.test(color)) block.palette[theme][role] = color.toUpperCase();
          else bad(`у роли \`palette.${theme}.${role}\` цвет не в виде \`#RRGGBB\` или \`#RRGGBBAA\`.`);
        }
      }
    } else if (raw['palette'] !== undefined) bad('`palette` должен быть объектом.');

    if (isObject(raw['themes'])) {
      for (const [name, item] of Object.entries(raw['themes'])) {
        if (!THEME_NAME.test(name) || (BASE_THEMES as readonly string[]).includes(name)) {
          bad(`имя темы \`${name}\` не годится: строчные латинские буквы, цифры и дефис, не \`light\` и не \`dark\`.`);
          continue;
        }
        if (!isObject(item) || (item['mode'] !== 'light' && item['mode'] !== 'dark')) {
          bad(`у темы \`${name}\` нужен \`mode\`: \`light\` или \`dark\` — база, от которой она наследуется.`);
          continue;
        }
        const theme: { mode: BaseTheme; label: string | null; palette: Record<string, string> } = {
          mode: item['mode'],
          label: typeof item['label'] === 'string' && item['label'].trim() !== '' ? item['label'].trim() : null,
          palette: {}
        };
        if (isObject(item['palette'])) {
          for (const [role, color] of Object.entries(item['palette'])) {
            if (typeof color === 'string' && COLOR.test(color)) theme.palette[role] = color.toUpperCase();
            else bad(`у роли \`themes.${name}.palette.${role}\` цвет не в виде \`#RRGGBB\` или \`#RRGGBBAA\`.`);
          }
        } else if (item['palette'] !== undefined) bad(`\`themes.${name}.palette\` должен быть объектом.`);
        block.themes[name] = theme;
      }
    } else if (raw['themes'] !== undefined) bad('`themes` должен быть объектом.');

    if (isObject(raw['i18n'])) {
      const i18n = raw['i18n'];
      for (const key of ['default', 'fallback'] as const) {
        const value = i18n[key];
        if (value === undefined) continue;
        if (typeof value === 'string' && LOCALE.test(value)) block.i18n[key] = value;
        else bad(`\`i18n.${key}\` — код языка вроде \`ru\` или \`en\`.`);
      }
      if (i18n['locales'] !== undefined) {
        if (Array.isArray(i18n['locales'])) {
          for (const item of i18n['locales']) {
            if (typeof item === 'string' && LOCALE.test(item)) block.i18n.locales.push(item);
            else bad('в `i18n.locales` — коды языков вроде `ru` или `en`.');
          }
        } else bad('`i18n.locales` должен быть списком кодов языков.');
      }
    } else if (raw['i18n'] !== undefined) bad('`i18n` должен быть объектом.');

    if (Array.isArray(raw['components'])) {
      for (const item of raw['components']) {
        if (isObject(item) && typeof item['name'] === 'string' && item['name'] !== '') {
          block.components.push({
            name: item['name'],
            ...(typeof item['summary'] === 'string' ? { summary: item['summary'] } : {})
          });
        } else bad('у компонента в `components` нужно `name`.');
      }
    } else if (raw['components'] !== undefined) bad('`components` должен быть списком.');

    if (Array.isArray(raw['overrides'])) {
      block.overrides = raw['overrides'].filter((item): item is string => typeof item === 'string');
    } else if (raw['overrides'] !== undefined) bad('`overrides` должен быть списком ключей.');

    for (const [key, value] of Object.entries(raw)) {
      if (!KNOWN_KEYS.has(key)) block.extra[key] = value;
    }

    blocks.push(block);
  }
  return { blocks, problems };
}

/* ---------- контраст ---------- */

interface Rgb { r: number; g: number; b: number; a: number }

function toRgb(color: string): Rgb {
  const hex = color.slice(1);
  const part = (at: number) => parseInt(hex.slice(at, at + 2), 16);
  return { r: part(0), g: part(2), b: part(4), a: hex.length === 8 ? part(6) / 255 : 1 };
}

/** Относительная яркость sRGB по WCAG 2.x. */
export function luminance(color: Pick<Rgb, 'r' | 'g' | 'b'>): number {
  const linear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

function over(front: Rgb, back: Rgb): Rgb {
  const mix = (a: number, b: number) => Math.round(a * front.a + b * (1 - front.a));
  return { r: mix(front.r, back.r), g: mix(front.g, back.g), b: mix(front.b, back.b), a: 1 };
}

const hexOf = (color: Rgb) =>
  `#${[color.r, color.g, color.b].map((channel) => channel.toString(16).padStart(2, '0')).join('').toUpperCase()}`;

/**
 * Контраст двух цветов. Цвет с прозрачностью кладётся на `backdrop` (по
 * умолчанию — на белый), иначе число описывало бы не то, что видит человек.
 */
export function contrastRatio(foreground: string, background: string, backdrop?: string): number {
  const back = over(toRgb(background), backdrop ? toRgb(backdrop) : { r: 255, g: 255, b: 255, a: 1 });
  const front = over(toRgb(foreground), back);
  const a = luminance(front);
  const b = luminance(back);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(ratio * 100) / 100;
}

/* ---------- темы ---------- */

/** Светлая, тёмная и добавленные проектом — в порядке объявления. */
export function themeNames(tokens: Pick<DesignTokens, 'themes'>): string[] {
  return [...BASE_THEMES, ...Object.keys(tokens.themes)];
}

/** Итоговая палитра темы: база и поверх неё переопределённые роли. */
export function themePalette(tokens: Pick<DesignTokens, 'palette' | 'themes'>, name: string): Record<string, Sourced<string>> {
  const base = (BASE_THEMES as readonly string[]).includes(name) ? (name as BaseTheme) : undefined;
  if (base) return tokens.palette[base];
  const theme = tokens.themes[name];
  if (!theme) return {};
  return { ...tokens.palette[theme.mode.value], ...theme.colors };
}

/* ---------- сложение ---------- */

interface Placed {
  block: ParsedBlock;
  source: string;
  level: DesignLevel;
  record: string;
}

export function resolveDesign(input: { general: readonly DesignRecord[]; local: readonly DesignRecord[] }): DesignResolution {
  const problems: { record: string; message: string }[] = [];
  const placed: Placed[] = [];

  const place = (record: DesignRecord, level: DesignLevel) => {
    const parsed = parseDesignBlocks(record);
    problems.push(...parsed.problems);
    for (const block of parsed.blocks) placed.push({ block, source: label(record), level, record: record.id });
  };
  for (const record of input.general) place(record, 'general');
  for (const record of input.local) place(record, 'local');

  const tokens: DesignTokens = {
    root: null,
    principles: [],
    typography: {},
    spacing: {},
    radius: {},
    grid: { columns: null, gutter: null, breakpoints: {}, containers: {} },
    palette: { light: {}, dark: {} },
    themes: {},
    i18n: { default: null, fallback: null, locales: [] },
    components: [],
    extra: {}
  };
  const conflicts: { key: string; records: string[] }[] = [];

  /** Ключ с одним значением: поздний уровень заменяет ранний, спор — в `conflicts`. */
  const set = <T>(
    bag: Record<string, Sourced<T>>,
    name: string,
    key: string,
    value: T,
    from: Placed
  ) => {
    const previous = bag[name];
    if (!previous) {
      bag[name] = { value, source: from.source, level: from.level, overrides: [] };
      return;
    }
    if (previous.source === from.source) {
      // Одна запись, несколько блоков: уточнение самой себя не спор.
      bag[name] = { ...previous, value };
      return;
    }
    if (JSON.stringify(previous.value) === JSON.stringify(value)) return;

    const deliberate = from.level === 'local' && previous.level === 'general' && from.block.overrides.includes(key);
    const dispute = previous.level === from.level || from.level === 'local';
    if (dispute && !deliberate && !conflicts.some((item) => item.key === key && item.records.join() === [previous.source, from.source].join())) {
      conflicts.push({ key, records: [previous.source, from.source] });
    }
    bag[name] = { value, source: from.source, level: from.level, overrides: [...previous.overrides, previous.source] };
  };

  /** Одиночное значение: оборачивается в корзину из одного ключа. */
  const single = <T>(current: Sourced<T> | null, key: string, value: T, from: Placed): Sourced<T> => {
    const bag: Record<string, Sourced<T>> = current ? { v: current } : {};
    set(bag, 'v', key, value, from);
    return bag['v'] as Sourced<T>;
  };

  const modeBags: Record<string, Record<string, Sourced<BaseTheme>>> = {};
  const labelBags: Record<string, Record<string, Sourced<string>>> = {};
  const colorBags: Record<string, Record<string, Sourced<string>>> = {};

  for (const from of placed) {
    const { block } = from;

    if (block.root !== null) tokens.root = single(tokens.root, 'root', block.root, from);

    for (const text of block.principles) {
      if (!tokens.principles.some((item) => item.value === text)) {
        tokens.principles.push({ value: text, source: from.source, level: from.level, overrides: [] });
      }
    }
    for (const [name, value] of Object.entries(block.typography)) set(tokens.typography, name, `typography.${name}`, value, from);
    for (const [name, value] of Object.entries(block.spacing)) set(tokens.spacing, name, `spacing.${name}`, value, from);
    for (const [name, value] of Object.entries(block.radius)) set(tokens.radius, name, `radius.${name}`, value, from);

    if (block.grid.columns !== null) tokens.grid.columns = single(tokens.grid.columns, 'grid.columns', block.grid.columns, from);
    if (block.grid.gutter !== null) tokens.grid.gutter = single(tokens.grid.gutter, 'grid.gutter', block.grid.gutter, from);
    for (const [name, value] of Object.entries(block.grid.breakpoints)) set(tokens.grid.breakpoints, name, `grid.breakpoints.${name}`, value, from);
    for (const [name, value] of Object.entries(block.grid.containers)) set(tokens.grid.containers, name, `grid.containers.${name}`, value, from);

    for (const theme of BASE_THEMES) {
      for (const [role, value] of Object.entries(block.palette[theme])) {
        set(tokens.palette[theme], role, `palette.${theme}.${role}`, value, from);
      }
    }

    for (const [name, theme] of Object.entries(block.themes)) {
      set((modeBags[name] ??= {}), 'mode', `themes.${name}.mode`, theme.mode, from);
      if (theme.label !== null) set((labelBags[name] ??= {}), 'label', `themes.${name}.label`, theme.label, from);
      for (const [role, value] of Object.entries(theme.palette)) {
        set((colorBags[name] ??= {}), role, `themes.${name}.${role}`, value, from);
      }
    }

    if (block.i18n.default !== null) tokens.i18n.default = single(tokens.i18n.default, 'i18n.default', block.i18n.default, from);
    if (block.i18n.fallback !== null) tokens.i18n.fallback = single(tokens.i18n.fallback, 'i18n.fallback', block.i18n.fallback, from);
    for (const locale of block.i18n.locales) {
      if (!tokens.i18n.locales.some((item) => item.value === locale)) {
        tokens.i18n.locales.push({ value: locale, source: from.source, level: from.level, overrides: [] });
      }
    }

    for (const component of block.components) {
      const found = tokens.components.find((item) => item.value.name === component.name);
      if (!found) {
        tokens.components.push({ value: component, source: from.source, level: from.level, overrides: [] });
        continue;
      }
      if (JSON.stringify(found.value) === JSON.stringify(component)) continue;
      const bag: Record<string, Sourced<DesignComponent>> = { [component.name]: found };
      set(bag, component.name, `components.${component.name}`, component, from);
      tokens.components[tokens.components.indexOf(found)] = bag[component.name] as Sourced<DesignComponent>;
    }
    for (const [key, value] of Object.entries(block.extra)) set(tokens.extra, key, key, value, from);
  }

  for (const name of Object.keys(modeBags)) {
    tokens.themes[name] = {
      mode: modeBags[name]!['mode'] as Sourced<BaseTheme>,
      label: labelBags[name]?.['label'] ?? null,
      colors: colorBags[name] ?? {}
    };
  }

  // Тема может переопределять только роли, которые есть у базовых палитр: «своя» роль темы
  // не имела бы значения в остальных темах, и компонент, её читающий, ломался бы при смене.
  const knownRoles = new Set<string>([...PALETTE_ROLES, ...Object.keys(tokens.palette.light), ...Object.keys(tokens.palette.dark)]);
  for (const [name, theme] of Object.entries(tokens.themes)) {
    for (const [role, item] of Object.entries(theme.colors)) {
      if (knownRoles.has(role)) continue;
      problems.push({
        record: item.source.replace(/^\[[^\]]*\]\s*/, ''),
        message: `Блок \`docdd-design\`: тема \`${name}\` переопределяет роль \`${role}\`, которой нет в базовых палитрах.`
      });
      delete theme.colors[role];
    }
  }

  const seen = new Set<string>();
  const sources: DesignResolution['sources'] = [];
  for (const item of placed) {
    if (seen.has(item.source)) continue;
    seen.add(item.source);
    sources.push({ id: item.source, level: item.level });
  }

  // Блоки, не принятые целиком (нет единицы), всё равно называются: пустым проект не считается.
  const empty = placed.length === 0 && problems.length === 0;
  const contrast = placed.length === 0 ? [] : contrastRows(tokens);
  const checks: DesignCheck[] = empty ? [] : [
    ...problems.map((problem) => ({ code: 'design_block_invalid' as const, message: problem.message, source: problem.record })),
    ...conflicts.map((conflict) => ({
      code: 'design_conflict' as const,
      message: `Записи ${conflict.records.join(' и ')} задают разное для \`${conflict.key}\`: действует поздняя. Назовите ключ в \`overrides\`, если это осознанно, или сведите значение.`,
      source: conflict.records[conflict.records.length - 1] ?? null
    })),
    ...(placed.length === 0 ? [] : completeness(tokens)),
    ...contrast.filter((row) => !row.ok).map((row) => ({
      code: 'design_contrast_low' as const,
      message: `Контраст пары \`${row.pair[0]}\`/\`${row.pair[1]}\` в теме \`${row.theme}\` — ${row.ratio}:1, ниже ${MIN_CONTRAST}:1.`,
      source: themePalette(tokens, row.theme)[row.pair[0]]?.source ?? null,
      theme: row.theme,
      pair: row.pair,
      ratio: row.ratio
    }))
  ];

  return { tokens, checks, contrast, conflicts, problems, sources, empty };
}

function contrastRows(tokens: DesignTokens): ContrastRow[] {
  const rows: ContrastRow[] = [];
  for (const theme of themeNames(tokens)) {
    const palette = themePalette(tokens, theme);
    const base = palette['bg']?.value;
    for (const pair of CONTRAST_PAIRS) {
      const foreground = palette[pair[0]]?.value;
      const background = palette[pair[1]]?.value;
      // Нет роли в теме — это `design_theme_incomplete`, а не нулевой контраст.
      if (!foreground || !background) continue;
      const ratio = contrastRatio(foreground, background, base);
      const resolved = over(toRgb(background), base ? toRgb(base) : { r: 255, g: 255, b: 255, a: 1 });
      rows.push({
        theme,
        pair: [pair[0], pair[1]],
        ratio,
        ok: ratio >= MIN_CONTRAST,
        fg: hexOf(over(toRgb(foreground), resolved)),
        bg: hexOf(resolved)
      });
    }
  }
  return rows;
}

function completeness(tokens: DesignTokens): DesignCheck[] {
  const found: DesignCheck[] = [];
  const gap = (what: string, names: readonly string[], have: readonly string[]) => {
    const missing = names.filter((name) => !have.includes(name));
    if (missing.length === 0) return;
    found.push({
      code: 'design_scale_gap',
      message: `В ${what} не хватает обязательных имён: ${missing.join(', ')}.`,
      source: null,
      names: missing
    });
  };
  gap('шкале типографики', TYPOGRAPHY_NAMES, Object.keys(tokens.typography));
  gap('шкале отступов', SPACING_NAMES, Object.keys(tokens.spacing));
  gap('шкале радиусов', RADIUS_NAMES, Object.keys(tokens.radius));
  gap('реестре компонентов', COMPONENT_NAMES, tokens.components.map((item) => item.value.name));

  // Сетка: колонки и поле — числа, точки перелома и контейнеры — словари; точки только по возрастанию.
  const scalars = [
    ...(tokens.grid.columns === null ? ['columns'] : []),
    ...(tokens.grid.gutter === null ? ['gutter'] : [])
  ];
  if (scalars.length > 0) {
    found.push({ code: 'design_scale_gap', message: `В сетке не заданы: ${scalars.join(', ')}.`, source: null, names: scalars });
  }
  gap('точках перелома сетки', BREAKPOINT_NAMES, Object.keys(tokens.grid.breakpoints));
  gap('ширинах контейнеров сетки', CONTAINER_NAMES, Object.keys(tokens.grid.containers));
  const points = BREAKPOINT_NAMES.filter((name) => name in tokens.grid.breakpoints).map((name) => tokens.grid.breakpoints[name]!.value);
  const ascending = points.every((value, at) => at === 0 || value > (points[at - 1] as number));
  if (!ascending || (points.length > 0 && points[0] !== 0)) {
    found.push({
      code: 'design_scale_gap',
      message: 'Точки перелома сетки должны строго возрастать от `xs`, а `xs` — 0.',
      source: tokens.grid.breakpoints['xs']?.source ?? null,
      names: []
    });
  }

  const inLight = Object.keys(tokens.palette.light);
  const inDark = Object.keys(tokens.palette.dark);
  const anywhere = new Set([...inLight, ...inDark]);
  gap('палитре (ни в одной теме)', PALETTE_ROLES, [...anywhere]);

  for (const [theme, have, other] of [['light', inLight, inDark], ['dark', inDark, inLight]] as const) {
    const missing = other.filter((role) => !have.includes(role));
    if (missing.length === 0) continue;
    found.push({
      code: 'design_theme_incomplete',
      message: `В ${theme === 'light' ? 'светлой' : 'тёмной'} теме нет ролей, которые есть в другой: ${missing.join(', ')}.`,
      source: null,
      theme,
      names: missing
    });
  }

  found.push(...i18nChecks(tokens));
  return found;
}

function i18nChecks(tokens: DesignTokens): DesignCheck[] {
  const locales = tokens.i18n.locales.map((item) => item.value);
  const trouble: string[] = [];
  if (locales.length < MIN_LOCALES) trouble.push(`языков ${locales.length}, нужно не меньше ${MIN_LOCALES}`);
  if (!locales.includes(REQUIRED_LOCALE)) trouble.push(`нет английского (\`${REQUIRED_LOCALE}\`)`);
  const standard = tokens.i18n.default?.value;
  const fallback = tokens.i18n.fallback?.value;
  if (!standard) trouble.push('не назван `default`');
  else if (!locales.includes(standard)) trouble.push(`\`default: ${standard}\` не из списка языков`);
  if (!fallback) trouble.push('не назван `fallback`');
  else if (!locales.includes(fallback)) trouble.push(`\`fallback: ${fallback}\` не из списка языков`);
  if (trouble.length === 0) return [];
  return [{
    code: 'design_i18n_missing',
    message: `i18n: ${trouble.join('; ')}. Интерфейс не знает языка: нужны минимум два языка, основной и английский.`,
    source: null
  }];
}

/* ---------- плоский вид ---------- */

/** Значения без происхождения — вход для выгрузки в стеки (server/lib/design-export.ts). */
export interface PlainTokens {
  /** Пикселей в `1rem` для платформ без rem. */
  root: number;
  principles: string[];
  /** Все размеры — в rem. */
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  grid: {
    columns: number;
    gutter: number;
    breakpoints: Record<string, number>;
    containers: Record<string, number>;
  };
  /** Базовые темы. */
  palette: Record<BaseTheme, Record<string, string>>;
  /** Добавленные темы с итоговой палитрой (база + переопределения). */
  themes: Record<string, { label: string; mode: BaseTheme; palette: Record<string, string> }>;
  i18n: { default: string; fallback: string; locales: string[] };
  components: DesignComponent[];
}

export function plainTokens(tokens: DesignTokens): PlainTokens {
  const values = <T>(bag: Record<string, Sourced<T>>): Record<string, T> =>
    Object.fromEntries(Object.entries(bag).map(([key, item]) => [key, item.value]));
  const locales = tokens.i18n.locales.map((item) => item.value);

  return {
    root: tokens.root?.value ?? DEFAULT_ROOT,
    principles: tokens.principles.map((item) => item.value),
    typography: values(tokens.typography),
    spacing: values(tokens.spacing),
    radius: values(tokens.radius),
    grid: {
      columns: tokens.grid.columns?.value ?? DEFAULT_GRID.columns,
      gutter: tokens.grid.gutter?.value ?? DEFAULT_GRID.gutter,
      breakpoints: Object.keys(tokens.grid.breakpoints).length > 0 ? values(tokens.grid.breakpoints) : { ...DEFAULT_GRID.breakpoints },
      containers: Object.keys(tokens.grid.containers).length > 0 ? values(tokens.grid.containers) : { ...DEFAULT_GRID.containers }
    },
    palette: { light: values(tokens.palette.light), dark: values(tokens.palette.dark) },
    themes: Object.fromEntries(Object.entries(tokens.themes).map(([name, theme]) => [name, {
      label: theme.label?.value ?? name,
      mode: theme.mode.value,
      palette: values(themePalette(tokens, name))
    }])),
    i18n: {
      default: tokens.i18n.default?.value ?? locales[0] ?? 'ru',
      fallback: tokens.i18n.fallback?.value ?? REQUIRED_LOCALE,
      locales: locales.length > 0 ? locales : ['ru', REQUIRED_LOCALE]
    },
    components: tokens.components.map((item) => item.value)
  };
}
