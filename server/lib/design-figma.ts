import { DEFAULT_ROOT, PALETTE_ROLES, type PlainTokens } from './design';

/**
 * Импорт токенов из Figma Variables (docs/16-design-system.md, «Токены из
 * Figma»): разбор ответа REST API `GET /v1/files/:key/variables/local` (или его
 * части `meta`) в блок `docdd-design` и перечень расхождений с токенами проекта.
 * Чистые функции: ничего не пишут, блок человек подтверждает как любой другой.
 *
 * Имена переменных читаются по пути через `/` — как их называют в Figma:
 * `palette/accent`, `spacing/md`, `radius/sm`, `typography/body/size`.
 * Режимы коллекции `Light` и `Dark` дают базовые темы, прочие — добавленные.
 */

export interface FigmaImport {
  /** Готовый блок: только то, что нашлось и опознано. */
  block: Record<string, unknown>;
  /** Что именно опознано: `палитра light: 13`… */
  found: { group: string; count: number }[];
  /** Переменные, которые не опознаны: их имя и причина — молча терять нельзя. */
  skipped: { name: string; reason: string }[];
  problems: string[];
}

export interface TokenDiff {
  key: string;
  before: string | null;
  after: string;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => value !== null && typeof value === 'object' && !Array.isArray(value);

interface Rgba { r: number; g: number; b: number; a?: number }
const isRgba = (value: unknown): value is Rgba =>
  isObject(value) && typeof value['r'] === 'number' && typeof value['g'] === 'number' && typeof value['b'] === 'number';

const channel = (value: number) => Math.round(Math.max(0, Math.min(1, value)) * 255).toString(16).padStart(2, '0').toUpperCase();

/** Цвет Figma (0..1) → `#RRGGBB` или `#RRGGBBAA`. */
export function figmaColor(value: Rgba): string {
  const base = `#${channel(value.r)}${channel(value.g)}${channel(value.b)}`;
  return value.a !== undefined && value.a < 0.999 ? `${base}${channel(value.a)}` : base;
}

const round = (value: number) => Number(value.toFixed(4));
const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const ROLE_BY_LOWER = new Map(PALETTE_ROLES.map((role) => [role.toLowerCase(), role as string]));

/** Что за группа: по первому сегменту пути. */
const GROUPS: Readonly<Record<string, string>> = {
  palette: 'palette', color: 'palette', colors: 'palette', semantic: 'palette',
  spacing: 'spacing', space: 'spacing',
  radius: 'radius', radii: 'radius', corner: 'radius',
  border: 'border', borders: 'border', stroke: 'border',
  icon: 'icon', icons: 'icon',
  motion: 'motion', duration: 'motion',
  typography: 'typography', font: 'font', fonts: 'font', text: 'typography',
  grid: 'grid'
};

export function parseFigmaVariables(input: unknown, root = DEFAULT_ROOT): FigmaImport {
  const problems: string[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const counts = new Map<string, number>();
  const count = (group: string) => counts.set(group, (counts.get(group) ?? 0) + 1);

  let meta: unknown = input;
  if (isObject(input) && isObject(input['meta'])) meta = input['meta'];
  if (!isObject(meta) || !isObject(meta['variables'])) {
    return { block: {}, found: [], skipped, problems: ['В JSON нет `meta.variables` — это не ответ Figma Variables API.'] };
  }
  const variables = meta['variables'] as Json;
  const collections = isObject(meta['variableCollections']) ? (meta['variableCollections'] as Json) : {};

  const block: Record<string, unknown> = { unit: 'rem' };
  const palette: Record<string, Record<string, string>> = {};
  const themeNames: Record<string, string> = {};
  const set = (path: string[], value: unknown) => {
    let target = block as Json;
    for (const key of path.slice(0, -1)) target = (target[key] ??= {}) as Json;
    target[path[path.length - 1] as string] = value;
  };

  /** Значение с разыменованием одного уровня алиасов. */
  const valueOf = (variable: Json, mode: string, depth = 0): unknown => {
    const by = isObject(variable['valuesByMode']) ? (variable['valuesByMode'] as Json) : {};
    const value = by[mode];
    if (isObject(value) && value['type'] === 'VARIABLE_ALIAS' && typeof value['id'] === 'string' && depth < 4) {
      const target = variables[value['id']];
      if (isObject(target)) return valueOf(target, mode, depth + 1);
    }
    return value;
  };

  for (const raw of Object.values(variables)) {
    if (!isObject(raw) || typeof raw['name'] !== 'string') continue;
    const name = raw['name'];
    const type = raw['resolvedType'];
    const path = name.split('/').map((part) => part.trim()).filter((part) => part !== '');
    if (path.length === 0) continue;

    const group = GROUPS[(path[0] as string).toLowerCase()];
    const rest = group ? path.slice(1) : path;
    const collection = typeof raw['variableCollectionId'] === 'string' ? collections[raw['variableCollectionId']] : undefined;
    const modes = isObject(collection) && Array.isArray(collection['modes'])
      ? (collection['modes'] as Json[]).filter((mode) => typeof mode['modeId'] === 'string')
      : [];
    const modeEntries = modes.length > 0
      ? modes.map((mode) => ({ id: mode['modeId'] as string, name: String(mode['name'] ?? mode['modeId']) }))
      : Object.keys(isObject(raw['valuesByMode']) ? (raw['valuesByMode'] as Json) : {}).map((id) => ({ id, name: id }));

    if (type === 'COLOR') {
      const roleKey = (rest[rest.length - 1] ?? '').replace(/[^A-Za-z0-9]/g, '').toLowerCase();
      const role = ROLE_BY_LOWER.get(roleKey);
      if (group !== 'palette' && group !== undefined) {
        skipped.push({ name, reason: 'цвет вне группы palette/color' });
        continue;
      }
      if (!role) {
        skipped.push({ name, reason: 'роли нет в палитре дизайн-системы' });
        continue;
      }
      for (const mode of modeEntries) {
        const value = valueOf(raw, mode.id);
        if (!isRgba(value)) continue;
        const lowered = mode.name.trim().toLowerCase();
        const theme = lowered === 'light' || lowered === 'dark' ? lowered : slug(mode.name) || mode.id;
        (palette[theme] ??= {})[role] = figmaColor(value);
        themeNames[theme] = mode.name;
      }
      continue;
    }

    if (type === 'FLOAT') {
      const numeric = (modeId: string) => {
        const value = valueOf(raw, modeId);
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
      };
      const first = modeEntries[0] ? numeric(modeEntries[0].id) : null;
      if (first === null) {
        skipped.push({ name, reason: 'нет числового значения' });
        continue;
      }
      const key = rest.join('-') || path.join('-');
      const px = (value: number) => round(value / root);

      switch (group) {
        case 'spacing':
        case 'radius':
        case 'border':
        case 'icon':
          set([group, key], px(first));
          count(group);
          break;
        case 'motion':
          set(['motion', key], Math.round(first));
          count('motion');
          break;
        case 'typography': {
          const [nameKey, part] = [rest[0], rest[1] ?? 'size'];
          if (!nameKey || !['size', 'line', 'weight'].includes(part)) {
            skipped.push({ name, reason: 'ожидалось typography/<имя>/size|line|weight' });
            break;
          }
          set(['typography', nameKey, part], part === 'weight' ? Math.round(first) : px(first));
          count('typography');
          break;
        }
        case 'font': {
          // font/size/body, font/line/body, font/weight/body — так часто называют кегли.
          const [part, nameKey] = [rest[0], rest[1]];
          if ((part === 'size' || part === 'line' || part === 'weight') && nameKey) {
            set(['typography', nameKey, part], part === 'weight' ? Math.round(first) : px(first));
            count('typography');
          } else {
            skipped.push({ name, reason: 'ожидалось font/size|line|weight/<имя>' });
          }
          break;
        }
        case 'grid': {
          const [head, tail] = [rest[0], rest[1]];
          if (head === 'columns') set(['grid', 'columns'], Math.round(first));
          else if (head === 'gutter') set(['grid', 'gutter'], px(first));
          else if ((head === 'breakpoints' || head === 'containers') && tail) set(['grid', head, tail], px(first));
          else {
            skipped.push({ name, reason: 'ожидалось grid/columns, grid/gutter, grid/breakpoints/<имя>, grid/containers/<имя>' });
            break;
          }
          count('grid');
          break;
        }
        default:
          skipped.push({ name, reason: 'число вне известных групп (spacing, radius, border, icon, motion, typography, grid)' });
      }
      continue;
    }

    if (type === 'STRING') {
      if (group === 'font' && rest.length > 0) {
        const value = modeEntries[0] ? valueOf(raw, modeEntries[0].id) : null;
        if (typeof value === 'string' && value.trim() !== '') {
          set(['fonts', rest.join('-')], value.trim());
          count('fonts');
          continue;
        }
      }
      skipped.push({ name, reason: 'строка вне группы font' });
      continue;
    }

    skipped.push({ name, reason: `тип ${String(type)} не переносится в токены` });
  }

  // Палитры: light и dark — базовые, остальные режимы — добавленные темы с базой по имени.
  for (const [theme, colors] of Object.entries(palette)) {
    count(`palette:${theme}`);
    counts.set(`palette:${theme}`, Object.keys(colors).length);
    if (theme === 'light' || theme === 'dark') {
      set(['palette', theme], colors);
    } else {
      set(['themes', theme], {
        label: themeNames[theme] ?? theme,
        mode: /dark|night|contrast/i.test(themeNames[theme] ?? theme) ? 'dark' : 'light',
        palette: colors
      });
    }
  }

  const found = [...counts.entries()].map(([group, number]) => ({ group, count: number }));
  if (found.length === 0) problems.push('Ни одна переменная не опознана: проверьте имена (palette/<роль>, spacing/<имя>…).');
  return { block, found, skipped, problems };
}

/**
 * Расхождения блока с токенами проекта: что сменится, если принять импорт.
 * Сравниваются только ключи, названные в блоке.
 */
export function diffAgainst(current: PlainTokens, block: Record<string, unknown>): TokenDiff[] {
  const out: TokenDiff[] = [];
  const text = (value: unknown) => (value === undefined || value === null ? null : typeof value === 'string' ? value : JSON.stringify(value));
  const push = (key: string, before: unknown, after: unknown) => {
    // Ключа в импорте нет — это не «сменится на пусто», а «не названо».
    if (after === undefined) return;
    if (JSON.stringify(before) !== JSON.stringify(after)) out.push({ key, before: text(before), after: text(after) ?? '' });
  };
  const bag = (name: string): Json => (isObject(block[name]) ? (block[name] as Json) : {});

  for (const group of ['spacing', 'radius', 'border', 'icon', 'motion'] as const) {
    const have = current[group] as Record<string, number>;
    for (const [key, value] of Object.entries(bag(group))) push(`${group}.${key}`, have[key], value);
  }
  for (const [key, value] of Object.entries(bag('fonts'))) push(`fonts.${key}`, current.fonts[key], value);
  for (const [name, value] of Object.entries(bag('typography'))) {
    if (!isObject(value)) continue;
    for (const [part, number] of Object.entries(value)) {
      const have = current.typography[name] as unknown as Json | undefined;
      push(`typography.${name}.${part}`, have?.[part], number);
    }
  }
  const grid = bag('grid');
  push('grid.columns', current.grid.columns, grid['columns']);
  push('grid.gutter', current.grid.gutter, grid['gutter']);
  for (const part of ['breakpoints', 'containers'] as const) {
    const incoming = isObject(grid[part]) ? (grid[part] as Json) : {};
    for (const [key, value] of Object.entries(incoming)) push(`grid.${part}.${key}`, current.grid[part][key], value);
  }
  const palette = bag('palette');
  for (const theme of ['light', 'dark'] as const) {
    const incoming = isObject(palette[theme]) ? (palette[theme] as Json) : {};
    for (const [role, color] of Object.entries(incoming)) push(`palette.${theme}.${role}`, current.palette[theme][role], color);
  }
  for (const [name, theme] of Object.entries(bag('themes'))) {
    if (!isObject(theme) || !isObject(theme['palette'])) continue;
    for (const [role, color] of Object.entries(theme['palette'] as Json)) {
      push(`themes.${name}.${role}`, current.themes[name]?.palette[role], color);
    }
  }
  return out;
}

/** Блок как текст записи `design`. */
export function figmaBlockText(block: Record<string, unknown>): string {
  return ['```docdd-design', JSON.stringify(block, null, 2), '```'].join('\n');
}
