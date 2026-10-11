/**
 * Поверхности и вид (docs/16-design-system.md, «Поверхности и вид»): тени карточек,
 * подложка страницы, мягкая заливка плашек и подписи капсом. Эти токены живут в блоке
 * `docdd-design` под ключами `elevation`, `backdrop`, `tint`, `caps` — для сложения
 * они «незнакомые» ключи и приходят целиком от последнего блока, который их назвал.
 * Здесь — разбор и перевод в переменные CSS. Чистые функции.
 */

/** Слой тени: смещение и размытие в rem, прозрачность 0…1; цвет — роль палитры `shadow`. */
export interface ElevationLayer {
  y: number;
  blur: number;
  alpha: number;
  x: number;
  spread: number;
}

/** Пятно подложки: центр и размер эллипса в процентах страницы, цвет — роль, прозрачность 0…1. */
export interface BackdropGlow {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alpha: number;
}

export interface SurfaceTokens {
  elevation: Record<string, ElevationLayer[]>;
  backdrop: Record<string, BackdropGlow[]>;
  /** Доля роли в мягкой заливке: роль поверх `surface`. */
  tint: Record<string, number>;
  /** Типографика, которая набирается капсом: имя кегля → разрядка в em. */
  caps: Record<string, number>;
}

export const EMPTY_SURFACE: SurfaceTokens = { elevation: {}, backdrop: {}, tint: {}, caps: {} };

/** Роль палитры, чей цвет у теней. */
export const SHADOW_ROLE = 'shadow';

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const NAME = /^[a-z][A-Za-z0-9]*$/;

export interface SurfaceParse {
  surface: SurfaceTokens;
  /** Что не принято и почему: молча ничего не отбрасывается. */
  problems: string[];
}

/** Токены поверхностей из незнакомых ключей сложенного блока. */
export function parseSurface(extra: Readonly<Record<string, unknown>>): SurfaceParse {
  const surface: SurfaceTokens = { elevation: {}, backdrop: {}, tint: {}, caps: {} };
  const problems: string[] = [];

  const named = (key: string): [string, unknown][] => {
    const part = extra[key];
    if (part === undefined) return [];
    if (!isObject(part)) {
      problems.push(`\`${key}\` должен быть объектом.`);
      return [];
    }
    return Object.entries(part).filter(([name]) => {
      if (NAME.test(name)) return true;
      problems.push(`имя \`${key}.${name}\` не годится: латинские буквы и цифры, с маленькой буквы.`);
      return false;
    });
  };

  for (const [name, layers] of named('elevation')) {
    if (!Array.isArray(layers) || layers.length === 0) {
      problems.push(`\`elevation.${name}\` — непустой список слоёв тени.`);
      continue;
    }
    const parsed: ElevationLayer[] = [];
    for (const layer of layers) {
      const y = isObject(layer) ? num(layer['y']) : null;
      const blur = isObject(layer) ? num(layer['blur']) : null;
      const alpha = isObject(layer) ? num(layer['alpha']) : null;
      if (!isObject(layer) || y === null || blur === null || blur < 0 || alpha === null || alpha < 0 || alpha > 1) {
        problems.push(`слой в \`elevation.${name}\` — \`{ "y": rem, "blur": rem ≥ 0, "alpha": 0…1 }\`.`);
        continue;
      }
      parsed.push({ y, blur, alpha, x: num(layer['x']) ?? 0, spread: num(layer['spread']) ?? 0 });
    }
    if (parsed.length > 0) surface.elevation[name] = parsed;
  }

  for (const [name, glows] of named('backdrop')) {
    if (!Array.isArray(glows) || glows.length === 0) {
      problems.push(`\`backdrop.${name}\` — непустой список пятен.`);
      continue;
    }
    const parsed: BackdropGlow[] = [];
    for (const glow of glows) {
      const g = isObject(glow) ? glow : {};
      const [x, y, w, h, alpha] = [num(g['x']), num(g['y']), num(g['w']), num(g['h']), num(g['alpha'])];
      const color = typeof g['color'] === 'string' && NAME.test(g['color']) ? g['color'] : null;
      if (x === null || y === null || w === null || w <= 0 || h === null || h <= 0 || alpha === null || alpha < 0 || alpha > 1 || color === null) {
        problems.push(`пятно в \`backdrop.${name}\` — \`{ "x", "y", "w", "h" в %, "color": роль, "alpha": 0…1 }\`.`);
        continue;
      }
      parsed.push({ x, y, w, h, color, alpha });
    }
    if (parsed.length > 0) surface.backdrop[name] = parsed;
  }

  for (const [name, value] of named('tint')) {
    const share = num(value);
    if (share === null || share < 0 || share > 1) problems.push(`\`tint.${name}\` — доля от 0 до 1.`);
    else surface.tint[name] = share;
  }

  for (const [name, value] of named('caps')) {
    const tracking = num(value);
    if (tracking === null || tracking < 0 || tracking > 1) problems.push(`\`caps.${name}\` — разрядка в em от 0 до 1.`);
    else surface.caps[name] = tracking;
  }

  return { surface, problems };
}

const trim = (value: number, digits = 4) => String(Number(value.toFixed(digits)));
const percent = (alpha: number) => `${trim(alpha * 100, 2)}%`;
const mix = (role: string, alpha: number) => `color-mix(in srgb, var(--ds-color-${kebab(role)}) ${percent(alpha)}, transparent)`;
const kebab = (name: string) => name.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`);

/** Значение `box-shadow` из слоёв: цвет роли `shadow` берётся из темы, поэтому в тёмной она сама темнеет. */
export function elevationValue(layers: readonly ElevationLayer[]): string {
  return layers
    .map((layer) => `${trim(layer.x)}rem ${trim(layer.y)}rem ${trim(layer.blur)}rem ${trim(layer.spread)}rem ${mix(SHADOW_ROLE, layer.alpha)}`)
    .join(', ');
}

/** Значение `background-image` из пятен подложки. */
export function backdropValue(glows: readonly BackdropGlow[]): string {
  return glows
    .map((glow) => `radial-gradient(${trim(glow.w)}% ${trim(glow.h)}% at ${trim(glow.x)}% ${trim(glow.y)}%, ${mix(glow.color, glow.alpha)}, transparent)`)
    .join(', ');
}

/** Строки `:root { … }` с переменными поверхностей; порядок по имени — выгрузка не гуляет. */
export function surfaceVariables(surface: SurfaceTokens): string[] {
  const out: string[] = [];
  for (const name of Object.keys(surface.elevation).sort()) out.push(`  --ds-shadow-${kebab(name)}: ${elevationValue(surface.elevation[name]!)};`);
  for (const name of Object.keys(surface.backdrop).sort()) out.push(`  --ds-backdrop-${kebab(name)}: ${backdropValue(surface.backdrop[name]!)};`);
  for (const name of Object.keys(surface.tint).sort()) out.push(`  --ds-tint-${kebab(name)}: ${percent(surface.tint[name]!)};`);
  for (const name of Object.keys(surface.caps).sort()) out.push(`  --ds-tracking-${kebab(name)}: ${trim(surface.caps[name]!)}em;`);
  return out;
}

/** Классы набора капсом: `ds-kicker` = кегль `kicker` + разрядка + заглавные. */
export function capsClasses(surface: SurfaceTokens): string[] {
  const out: string[] = [];
  for (const name of Object.keys(surface.caps).sort()) {
    out.push(
      `.ds-${kebab(name)} {`,
      `  font-size: var(--ds-font-${kebab(name)});`,
      `  line-height: var(--ds-line-${kebab(name)});`,
      `  font-weight: var(--ds-weight-${kebab(name)});`,
      `  letter-spacing: var(--ds-tracking-${kebab(name)});`,
      '  text-transform: uppercase;',
      '}'
    );
  }
  return out;
}
