import codebase from '../../../../presets/map-types/codebase.json';
import embedded from '../../../../presets/map-types/embedded.json';
import gamedev from '../../../../presets/map-types/gamedev.json';
import research from '../../../../presets/map-types/research.json';
import domain from '../../../../presets/map-types/domain.json';
import strategic from '../../../../presets/map-types/strategic.json';
import sysdesign from '../../../../presets/map-types/sysdesign.json';
import { mergeStandard, type MapStandard, type StandardOverride } from '../domain/standard';

/**
 * Встроенные стандарты четырёх обязательных шаблонов (A-0010, п. 2 и 4). Файлы — в
 * `presets/map-types/`, их форму держит `docs/schemas/map-standard.schema.json` (тест), поэтому
 * приведение типа здесь честное.
 */
export const BUILTIN_STANDARDS: Readonly<Record<string, MapStandard>> = {
  strategic: strategic as MapStandard,
  domain: domain as MapStandard,
  sysdesign: sysdesign as MapStandard,
  codebase: codebase as MapStandard
};

/** Прежние имена видов в файлах (ADR-0035): `functional` — стратегическая, `codemap` — кодовая база. */
const ALIASES: Readonly<Record<string, string>> = { functional: 'strategic', codemap: 'codebase' };

export const INDUSTRY_STANDARDS: Readonly<Record<string, MapStandard>> = {
  gamedev: gamedev as MapStandard, embedded: embedded as MapStandard, research: research as MapStandard
};
const ALL_STANDARDS = { ...BUILTIN_STANDARDS, ...INDUSTRY_STANDARDS };

export function builtinTemplate(name: string): string | null {
  const id = ALIASES[name] ?? name;
  return Object.hasOwn(ALL_STANDARDS, id) ? id : null;
}

/** Стандарт шаблона с переопределениями проекта (`maps.standards` в манифесте). */
export function standardFor(name: string, overrides: readonly StandardOverride[] = []): { standard: MapStandard; problems: string[] } | null {
  const id = builtinTemplate(name);
  if (!id) return null;
  let standard = ALL_STANDARDS[id] as MapStandard;
  const problems: string[] = [];
  for (const override of overrides) {
    if (builtinTemplate(override.extends) !== id) continue;
    const merged = mergeStandard(standard, override);
    standard = merged.standard;
    problems.push(...merged.problems);
  }
  return { standard, problems };
}

/** Переопределения из манифеста; чужая форма пропускается — линтер не должен падать на манифесте. */
export function overridesFrom(raw: unknown): StandardOverride[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is StandardOverride => Boolean(item) && typeof item === 'object' && typeof (item as { extends?: unknown }).extends === 'string');
}
