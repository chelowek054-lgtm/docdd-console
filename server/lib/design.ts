/**
 * Токены дизайна (docs/16-design-system.md, ADR-0022): разбор блоков `docdd-design`
 * из подтверждённых `design`, сложение «глобальное → проект» и проверки. Чистые
 * функции над текстом записей: ни файловой системы, ни Nuxt.
 */

export interface DesignRecord {
  id: string;
  /** Метка проекта-источника у общих токенов; у локальных её нет. */
  label?: string | undefined;
  body: string;
}

export type ThemeName = 'light' | 'dark';
export type Palette = Record<string, string>;

export interface DesignTokens {
  principles: string[];
  constraints: { minTap: number; minContrast: number; gutter: number };
  typography: Record<string, number>;
  spacing: Record<string, number>;
  radii: Record<string, number>;
  palette: Record<ThemeName, Palette>;
  components: string[];
}

export type DesignCheckCode = 'design_contrast_low' | 'design_theme_incomplete' | 'design_scale_gap' | 'design_conflict';

export interface DesignCheck {
  code: DesignCheckCode;
  message: string;
  /** Ключ токена, о котором речь: `palette.light.ink`, `typography.body`. */
  key?: string;
  /** Для контраста — число. */
  ratio?: number;
}

export interface DesignProblem {
  record: string;
  message: string;
}

export interface DesignResolution {
  /** `null` — токенов нет нигде. */
  tokens: DesignTokens | null;
  /** Ключ токена → запись-источник (`A-0001`, `[docdd] D-0001`). */
  sources: Record<string, string>;
  conflicts: { key: string; kept: string; overridden: string }[];
  problems: DesignProblem[];
  checks: DesignCheck[];
}

/** Обязательные имена: без них проверка шкалы и темы называет пробел. */
export const REQUIRED_ROLES = ['bg', 'surface', 'surfaceAlt', 'ink', 'muted', 'line', 'accent', 'onAccent', 'core', 'ok', 'warn', 'danger', 'onDanger'] as const;
export const REQUIRED_TYPOGRAPHY = ['caption', 'small', 'body', 'lead', 'title', 'display'] as const;
export const REQUIRED_SPACING = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const;
export const REQUIRED_RADII = ['sm', 'md', 'pill'] as const;

const DEFAULT_CONSTRAINTS = { minTap: 44, minContrast: 4.5, gutter: 16 };

/** Пары «текст/фон»: одна тема, обе роли обязаны быть. */
export const CONTRAST_PAIRS: readonly (readonly [string, string])[] = [
  ['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['onAccent', 'accent'], ['onDanger', 'danger']
];

const BLOCK = /```docdd-design\s*\n([\s\S]*?)```/g;

type Block = Record<string, unknown>;

/** Блоки из тела записи; не разобравшийся блок — в `problems`, остальные идут дальше. */
export function parseDesignBlocks(record: DesignRecord): { blocks: Block[]; problems: DesignProblem[] } {
  const blocks: Block[] = [];
  const problems: DesignProblem[] = [];
  for (const match of record.body.matchAll(BLOCK)) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? '');
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('не объект');
      blocks.push(parsed as Block);
    } catch (error) {
      problems.push({ record: record.id, message: `Блок \`docdd-design\` не разобран: ${error instanceof Error ? error.message : String(error)}.` });
    }
  }
  return { blocks, problems };
}

/** Токены блока одним плоским списком «ключ → значение»; списки идут целиком под своим ключом. */
export function flattenBlock(block: Block): Map<string, unknown> {
  const flat = new Map<string, unknown>();
  const put = (key: string, value: unknown) => flat.set(key, value);
  const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

  if (Array.isArray(block['principles'])) put('principles', block['principles'].filter((item) => typeof item === 'string'));
  if (Array.isArray(block['components'])) put('components', block['components'].filter((item) => typeof item === 'string'));
  for (const group of ['constraints', 'typography', 'spacing', 'radii'] as const) {
    const value = block[group];
    if (!isObject(value)) continue;
    for (const [name, item] of Object.entries(value)) if (typeof item === 'number') put(`${group}.${name}`, item);
  }
  const palette = block['palette'];
  if (isObject(palette)) {
    for (const theme of ['light', 'dark'] as const) {
      const colors = palette[theme];
      if (!isObject(colors)) continue;
      for (const [role, color] of Object.entries(colors)) if (typeof color === 'string') put(`palette.${theme}.${role}`, color);
    }
  }
  return flat;
}

/** `locked` блока: `true` — всё, список — ключи и префиксы ключей (`palette`, `spacing.md`). */
function lockedBy(block: Block, key: string): boolean {
  const locked = block['locked'];
  if (locked === true) return true;
  if (!Array.isArray(locked)) return false;
  return locked.some((prefix) => typeof prefix === 'string' && (key === prefix || key.startsWith(`${prefix}.`)));
}

const tag = (record: DesignRecord) => (record.label ? `[${record.label}] ${record.id}` : record.id);

/**
 * Сложение: общие записи по порядку, затем локальные. Одиночные значения заменяются
 * более поздним уровнем, списки копятся. Токен, закреплённый `locked` в общем, остаётся
 * общим, а попытка проекта его перекрыть — `design_conflict`.
 */
export function resolveDesign(input: { general: readonly DesignRecord[]; local: readonly DesignRecord[] }): DesignResolution {
  const problems: DesignProblem[] = [];
  const sources: Record<string, string> = {};
  const values = new Map<string, unknown>();
  const lockedKeys = new Set<string>();
  const conflicts: DesignResolution['conflicts'] = [];
  let any = false;

  const apply = (records: readonly DesignRecord[], level: 'general' | 'local') => {
    for (const record of records) {
      const parsed = parseDesignBlocks(record);
      problems.push(...parsed.problems);
      for (const block of parsed.blocks) {
        any = true;
        for (const [key, value] of flattenBlock(block)) {
          if (Array.isArray(value)) {
            const before = (values.get(key) as string[] | undefined) ?? [];
            values.set(key, [...before, ...value.filter((item) => !before.includes(item))]);
            sources[key] = sources[key] ? `${sources[key]}, ${tag(record)}` : tag(record);
            continue;
          }
          if (level === 'local' && lockedKeys.has(key) && values.get(key) !== value) {
            conflicts.push({ key, kept: sources[key] ?? '', overridden: tag(record) });
            continue;
          }
          values.set(key, value);
          sources[key] = tag(record);
          if (level === 'general' && lockedBy(block, key)) lockedKeys.add(key);
        }
      }
    }
  };
  apply(input.general, 'general');
  apply(input.local, 'local');

  if (!any) return { tokens: null, sources: {}, conflicts: [], problems, checks: [] };

  const group = (name: string): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [key, value] of values) if (key.startsWith(`${name}.`) && typeof value === 'number') result[key.slice(name.length + 1)] = value;
    return result;
  };
  const colors = (theme: ThemeName): Palette => {
    const result: Palette = {};
    for (const [key, value] of values) if (key.startsWith(`palette.${theme}.`) && typeof value === 'string') result[key.slice(`palette.${theme}.`.length)] = value;
    return result;
  };
  const constraints = { ...DEFAULT_CONSTRAINTS, ...group('constraints') };
  const tokens: DesignTokens = {
    principles: (values.get('principles') as string[] | undefined) ?? [],
    constraints,
    typography: group('typography'),
    spacing: group('spacing'),
    radii: group('radii'),
    palette: { light: colors('light'), dark: colors('dark') },
    components: (values.get('components') as string[] | undefined) ?? []
  };
  return { tokens, sources, conflicts, problems, checks: checkTokens(tokens, conflicts) };
}

function parseColor(value: string): [number, number, number] | null {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(value.trim());
  if (!match) return null;
  let hex = match[1] ?? '';
  if (hex.length === 3) hex = [...hex].map((char) => char + char).join('');
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
}

/** Относительная яркость sRGB по WCAG 2.x. */
function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Контраст двух цветов по WCAG 2.x (1…21); `null`, если цвет не разобран. */
export function contrastRatio(a: string, b: string): number | null {
  const first = parseColor(a);
  const second = parseColor(b);
  if (!first || !second) return null;
  const [light, dark] = [luminance(first), luminance(second)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** Проверки сложенных токенов (docs/16-design-system.md, «Проверки токенов»). */
export function checkTokens(tokens: DesignTokens, conflicts: DesignResolution['conflicts'] = []): DesignCheck[] {
  const checks: DesignCheck[] = [];

  for (const theme of ['light', 'dark'] as const) {
    const palette = tokens.palette[theme];
    for (const role of REQUIRED_ROLES) {
      if (palette[role] === undefined) {
        checks.push({ code: 'design_theme_incomplete', key: `palette.${theme}.${role}`, message: `В теме «${theme}» нет роли \`${role}\`.` });
      }
    }
    for (const [text, background] of CONTRAST_PAIRS) {
      const foreground = palette[text];
      const behind = palette[background];
      if (foreground === undefined || behind === undefined) continue;
      const ratio = contrastRatio(foreground, behind);
      if (ratio !== null && ratio < tokens.constraints.minContrast) {
        checks.push({
          code: 'design_contrast_low',
          key: `palette.${theme}.${text}`,
          ratio: Math.round(ratio * 100) / 100,
          message: `Тема «${theme}»: \`${text}\` на \`${background}\` — контраст ${ratio.toFixed(2)}:1, нужно не меньше ${tokens.constraints.minContrast}:1.`
        });
      }
    }
  }

  const scales: [string, readonly string[], Record<string, number>][] = [
    ['typography', REQUIRED_TYPOGRAPHY, tokens.typography],
    ['spacing', REQUIRED_SPACING, tokens.spacing],
    ['radii', REQUIRED_RADII, tokens.radii]
  ];
  for (const [name, required, actual] of scales) {
    for (const item of required) {
      if (actual[item] === undefined) checks.push({ code: 'design_scale_gap', key: `${name}.${item}`, message: `В шкале \`${name}\` нет обязательного имени \`${item}\`.` });
    }
  }

  for (const conflict of conflicts) {
    checks.push({
      code: 'design_conflict',
      key: conflict.key,
      message: `Проект пытается перекрыть закреплённый токен \`${conflict.key}\` (${conflict.kept}): ${conflict.overridden}. Действует общий.`
    });
  }
  return checks;
}
