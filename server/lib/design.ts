/**
 * Токены дизайна (docs/16-design-system.md, ADR-0022): разбор блоков
 * `docdd-design` из подтверждённых `decision`/`design`, сложение «общее →
 * локальное» с источником у каждой части и проверки — контраст по WCAG, полнота
 * тем и шкал, противоречие блоков. Чистые функции над текстом записей: ни
 * файловой системы, ни Nuxt — их можно проверять без сервера.
 *
 * Читает записи тем же способом, что `practice-rules.ts` читает `docdd-rules`:
 * источник приходит снаружи (`RuleRecord` с меткой проекта-источника), а сам
 * разбор об источниках ничего не знает.
 */

export interface DesignRecord {
  id: string;
  /** Метка проекта-источника у общих практик; у локальных её нет. */
  label?: string | undefined;
  body: string;
}

export type DesignLevel = 'general' | 'local';
export type DesignTheme = 'light' | 'dark';

export const DESIGN_THEMES: readonly DesignTheme[] = ['light', 'dark'];

/** Обязательные имена: минимум эталона, по сложенному результату (docs/16-design-system.md, «Словарь»). */
export const TYPOGRAPHY_NAMES = ['caption', 'small', 'body', 'lead', 'title', 'display'] as const;
export const SPACING_NAMES = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;
export const RADIUS_NAMES = ['sm', 'md', 'pill'] as const;
export const PALETTE_ROLES = [
  'bg', 'surface', 'surfaceAlt', 'ink', 'muted', 'line', 'accent', 'onAccent', 'core', 'ok', 'warn', 'danger', 'onDanger'
] as const;
export const COMPONENT_NAMES = ['TopBar', 'Card', 'Button', 'Field', 'Pill', 'Progress', 'Empty'] as const;

/** Пары «текст/фон», для которых держим контраст не ниже порога (R-0031). */
export const CONTRAST_PAIRS: readonly (readonly [string, string])[] = [
  ['ink', 'bg'],
  ['ink', 'surface'],
  ['muted', 'bg'],
  ['onAccent', 'accent'],
  ['onDanger', 'danger']
];

export const MIN_CONTRAST = 4.5;

export interface TypographyToken {
  size: number;
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

export interface DesignTokens {
  principles: Sourced<string>[];
  typography: Record<string, Sourced<TypographyToken>>;
  spacing: Record<string, Sourced<number>>;
  radius: Record<string, Sourced<number>>;
  palette: Record<DesignTheme, Record<string, Sourced<string>>>;
  components: Sourced<DesignComponent>[];
  /** Незнакомые ключи блока сохраняются как есть: проект вправе добавить своё. */
  extra: Record<string, Sourced<unknown>>;
}

export type DesignCheckCode =
  | 'design_block_invalid'
  | 'design_conflict'
  | 'design_scale_gap'
  | 'design_theme_incomplete'
  | 'design_contrast_low';

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
  principles: string[];
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  palette: Record<DesignTheme, Record<string, string>>;
  components: DesignComponent[];
  overrides: string[];
  extra: Record<string, unknown>;
}

const KNOWN_KEYS = new Set(['principles', 'typography', 'spacing', 'radius', 'palette', 'components', 'overrides']);

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const label = (record: DesignRecord) => (record.label ? `[${record.label}] ${record.id}` : record.id);

function emptyBlock(): ParsedBlock {
  return {
    principles: [],
    typography: {},
    spacing: {},
    radius: {},
    palette: { light: {}, dark: {} },
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

    const block = emptyBlock();

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
          bad(`у кегля \`${name}\` нужен положительный \`size\`.`);
          continue;
        }
        const token: TypographyToken = { size };
        const line = numeric(item['line']);
        const weight = numeric(item['weight']);
        if (item['line'] !== undefined && line === null) bad(`у кегля \`${name}\` \`line\` — неотрицательное число.`);
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
        if (value === null) bad(`в \`${key}.${name}\` нужно неотрицательное число.`);
        else block[key][name] = value;
      }
    }

    if (isObject(raw['palette'])) {
      for (const theme of DESIGN_THEMES) {
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
 * умолчанию — на сам фон пары), иначе число описывало бы не то, что видит человек.
 */
export function contrastRatio(foreground: string, background: string, backdrop?: string): number {
  const back = over(toRgb(background), backdrop ? toRgb(backdrop) : { r: 255, g: 255, b: 255, a: 1 });
  const front = over(toRgb(foreground), back);
  const a = luminance(front);
  const b = luminance(back);
  const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  return Math.round(ratio * 100) / 100;
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
    principles: [],
    typography: {},
    spacing: {},
    radius: {},
    palette: { light: {}, dark: {} },
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

  for (const from of placed) {
    const { block } = from;

    for (const text of block.principles) {
      if (!tokens.principles.some((item) => item.value === text)) {
        tokens.principles.push({ value: text, source: from.source, level: from.level, overrides: [] });
      }
    }
    for (const [name, value] of Object.entries(block.typography)) set(tokens.typography, name, `typography.${name}`, value, from);
    for (const [name, value] of Object.entries(block.spacing)) set(tokens.spacing, name, `spacing.${name}`, value, from);
    for (const [name, value] of Object.entries(block.radius)) set(tokens.radius, name, `radius.${name}`, value, from);
    for (const theme of DESIGN_THEMES) {
      for (const [role, value] of Object.entries(block.palette[theme])) {
        set(tokens.palette[theme], role, `palette.${theme}.${role}`, value, from);
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

  const seen = new Set<string>();
  const sources: DesignResolution['sources'] = [];
  for (const item of placed) {
    if (seen.has(item.source)) continue;
    seen.add(item.source);
    sources.push({ id: item.source, level: item.level });
  }

  const empty = placed.length === 0;
  const contrast = empty ? [] : contrastRows(tokens);
  const checks = empty ? [] : [
    ...problems.map((problem) => ({ code: 'design_block_invalid' as const, message: problem.message, source: problem.record })),
    ...conflicts.map((conflict) => ({
      code: 'design_conflict' as const,
      message: `Записи ${conflict.records.join(' и ')} задают разное для \`${conflict.key}\`: действует поздняя. Назовите ключ в \`overrides\`, если это осознанно, или сведите значение.`,
      source: conflict.records[conflict.records.length - 1] ?? null
    })),
    ...completeness(tokens),
    ...contrast.filter((row) => !row.ok).map((row) => ({
      code: 'design_contrast_low' as const,
      message: `Контраст пары \`${row.pair[0]}\`/\`${row.pair[1]}\` в ${row.theme === 'light' ? 'светлой' : 'тёмной'} теме — ${row.ratio}:1, ниже ${MIN_CONTRAST}:1.`,
      source: tokens.palette[row.theme][row.pair[0]]?.source ?? null,
      theme: row.theme,
      pair: row.pair,
      ratio: row.ratio
    }))
  ] as DesignCheck[];

  return { tokens, checks, contrast, conflicts, problems, sources, empty };
}

function contrastRows(tokens: DesignTokens): ContrastRow[] {
  const rows: ContrastRow[] = [];
  for (const theme of DESIGN_THEMES) {
    const palette = tokens.palette[theme];
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
  return found;
}

/* ---------- плоский вид ---------- */

/** Значения без происхождения — вход для выгрузки в стеки (server/lib/design-export.ts). */
export interface PlainTokens {
  principles: string[];
  typography: Record<string, TypographyToken>;
  spacing: Record<string, number>;
  radius: Record<string, number>;
  palette: Record<DesignTheme, Record<string, string>>;
  components: DesignComponent[];
}

export function plainTokens(tokens: DesignTokens): PlainTokens {
  const values = <T>(bag: Record<string, Sourced<T>>): Record<string, T> =>
    Object.fromEntries(Object.entries(bag).map(([key, item]) => [key, item.value]));
  return {
    principles: tokens.principles.map((item) => item.value),
    typography: values(tokens.typography),
    spacing: values(tokens.spacing),
    radius: values(tokens.radius),
    palette: { light: values(tokens.palette.light), dark: values(tokens.palette.dark) },
    components: tokens.components.map((item) => item.value)
  };
}
