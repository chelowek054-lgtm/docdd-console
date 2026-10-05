import type { ArchitectureConfig } from './types';

/**
 * Правила проверки в практиках (docs/12-practice-rules.md, ADR-0014): разбор
 * блоков `docdd-rules` из подтверждённых `decision`/`design` и сложение
 * «встроенный минимум → общие → локальные». Чистые функции над текстом записей.
 */

export interface RuleRecord {
  id: string;
  /** Метка проекта-источника у общих практик; у локальных её нет. */
  label?: string | undefined;
  body: string;
}

export type RuleLevel = 'general' | 'local';

export interface RuleProblem {
  /** Запись, в которой нашлась беда. */
  record: string;
  message: string;
}

export interface EffectiveRule {
  key: string;
  value: unknown;
  source: string;
  level: RuleLevel;
  /** Кого это правило перекрыло более ранним уровнем. */
  overrides: string[];
}

export interface RulesResolution {
  /** `null` — правил нет нигде: проверки нет. */
  config: ArchitectureConfig | null;
  rules: EffectiveRule[];
  conflicts: { key: string; records: string[] }[];
  problems: RuleProblem[];
  /** `used` — читается секция манифеста (блоков нет), `ignored` — есть блоки и секция, `absent` — секции нет. */
  manifest: 'used' | 'ignored' | 'absent';
  sources: { id: string; level: RuleLevel }[];
}

const BLOCK = /```docdd-rules\s*\n([\s\S]*?)```/g;

type Block = Record<string, unknown>;

/** Блоки правил из тела записи; не разобравшийся блок — в `problems`, остальные идут дальше. */
export function parseRuleBlocks(record: RuleRecord): { blocks: Block[]; problems: RuleProblem[] } {
  const blocks: Block[] = [];
  const problems: RuleProblem[] = [];
  for (const match of record.body.matchAll(BLOCK)) {
    try {
      const parsed: unknown = JSON.parse(match[1] ?? '');
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('не объект');
      blocks.push(parsed as Block);
    } catch (error) {
      problems.push({ record: record.id, message: `Блок \`docdd-rules\` не разобран: ${error instanceof Error ? error.message : String(error)}.` });
    }
  }
  return { blocks, problems };
}

const label = (record: RuleRecord) => (record.label ? `[${record.label}] ${record.id}` : record.id);

const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : []);

/** `{root}` в строках профиля подставляется там, где профиль применён. */
function withRoot(value: unknown, root: string): unknown {
  if (typeof value === 'string') return value.replace(/\{root\}/g, root);
  if (Array.isArray(value)) return value.map((item) => withRoot(item, root));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Block).map(([key, item]) => [key, withRoot(item, root)]));
  }
  return value;
}

interface Placed {
  block: Block;
  /** Откуда правило: запись, которая его задала (профиль — сама запись профиля). */
  source: string;
  level: RuleLevel;
  /** Запись, в чьём теле блок лежит. */
  record: string;
}

export function resolveRules(input: {
  manifest?: ArchitectureConfig | undefined;
  general: readonly RuleRecord[];
  local: readonly RuleRecord[];
}): RulesResolution {
  const problems: RuleProblem[] = [];
  const placed: Placed[] = [];
  const profiles = [...input.general, ...input.local];

  const place = (record: RuleRecord, level: RuleLevel) => {
    const parsed = parseRuleBlocks(record);
    problems.push(...parsed.problems);
    for (const block of parsed.blocks) {
      const uses = Array.isArray(block['use']) ? (block['use'] as unknown[]) : [];
      const rest = { ...block };
      delete rest['use'];
      // Профиль-шаблон (`{root}` в путях) в силу вступает только через `use`: сам по себе он ничего не значит.
      const isTemplate = JSON.stringify(rest).includes('{root}');
      if (Object.keys(rest).length > 0 && !isTemplate) placed.push({ block: rest, source: label(record), level, record: record.id });

      for (const use of uses) {
        const wanted = typeof (use as Block)?.['profile'] === 'string' ? ((use as Block)['profile'] as string) : '';
        const root = typeof (use as Block)?.['root'] === 'string' ? ((use as Block)['root'] as string) : '';
        const profile = profiles.find((item) => item.id === wanted || label(item) === wanted);
        const found = profile ? parseRuleBlocks(profile) : null;
        if (!profile || !found || found.blocks.length === 0) {
          problems.push({ record: record.id, message: `\`use\` называет запись \`${wanted}\`, но блока правил в ней нет: профиль не применён.` });
          continue;
        }
        for (const profileBlock of found.blocks) {
          const concrete = withRoot(profileBlock, root) as Block;
          delete concrete['use'];
          placed.push({ block: concrete, source: label(profile), level, record: record.id });
        }
      }
    }
  };

  for (const record of input.general) place(record, 'general');
  for (const record of input.local) place(record, 'local');

  if (placed.length === 0) {
    const manifest = input.manifest;
    return {
      config: manifest ?? null,
      rules: [],
      conflicts: [],
      problems,
      manifest: manifest ? 'used' : 'absent',
      sources: []
    };
  }

  const config: ArchitectureConfig = {};
  const owner = new Map<string, { source: string; level: RuleLevel; value: unknown; rule: EffectiveRule }>();
  const rules: EffectiveRule[] = [];
  const conflicts: RulesResolution['conflicts'] = [];

  /** Ключ с одним значением: поздний уровень заменяет ранний; спор внутри уровня — конфликт. */
  const set = (key: string, value: unknown, from: Placed): boolean => {
    const previous = owner.get(key);
    const rule: EffectiveRule = { key, value, source: from.source, level: from.level, overrides: [] };
    if (previous) {
      if (JSON.stringify(previous.value) === JSON.stringify(value)) return false;
      if (previous.level === from.level && previous.source !== from.source) {
        conflicts.push({ key, records: [previous.source, from.source] });
      }
      rule.overrides = [...previous.rule.overrides, previous.source];
      rules.splice(rules.indexOf(previous.rule), 1);
    }
    rules.push(rule);
    owner.set(key, { source: from.source, level: from.level, value, rule });
    return true;
  };
  /** Список копится: у каждого элемента свой ключ и свой источник. */
  const add = (key: string, value: unknown, from: Placed) => {
    if (owner.has(key)) return;
    const rule: EffectiveRule = { key, value, source: from.source, level: from.level, overrides: [] };
    rules.push(rule);
    owner.set(key, { source: from.source, level: from.level, value, rule });
  };

  const list = <K extends 'ignore' | 'unignore' | 'shared' | 'kernel' | 'independent'>(name: K, from: Placed) => {
    for (const item of strings(from.block[name])) {
      const bag = config as Record<string, string[] | undefined>;
      const target = (bag[name] ??= []);
      if (!target.includes(item)) target.push(item);
      add(`${name}:${item}`, item, from);
    }
  };

  for (const from of placed) {
    for (const name of ['ignore', 'unignore', 'shared', 'kernel', 'independent'] as const) list(name, from);

    const entries = from.block['entries'];
    if (entries !== null && typeof entries === 'object' && !Array.isArray(entries)) {
      for (const [language, names] of Object.entries(entries as Block)) {
        const value = strings(names);
        if (set(`entries:${language}`, value, from)) (config.entries ??= {})[language] = value;
      }
    }

    if (from.block['siblings'] === 'via-entry' || from.block['siblings'] === 'via-parent') {
      if (set('siblings', from.block['siblings'], from)) config.siblings = from.block['siblings'];
    }

    for (const module of Array.isArray(from.block['modules']) ? (from.block['modules'] as unknown[]) : []) {
      const item = module as Block;
      if (typeof item?.['path'] !== 'string' || (item['entry'] !== 'open' && item['entry'] !== 'closed')) continue;
      if (set(`modules:${item['path']}`, { entry: item['entry'] }, from)) {
        const modules = (config.modules ??= []).filter((existing) => existing.path !== item['path']);
        modules.push({ path: item['path'], entry: item['entry'] });
        config.modules = modules;
      }
    }

    for (const layer of Array.isArray(from.block['layers']) ? (from.block['layers'] as unknown[]) : []) {
      const item = layer as Block;
      const order = strings(item?.['order']);
      if (typeof item?.['root'] !== 'string' || order.length < 2) continue;
      const value = {
        root: item['root'],
        order,
        ...(item['slices'] === 'isolated' || item['slices'] === 'via-entry' ? { slices: item['slices'] } : {}),
        ...(strings(item['unsliced']).length ? { unsliced: strings(item['unsliced']) } : {})
      };
      if (set(`layers:${item['root']}`, value, from)) {
        const layers = (config.layers ??= []).filter((existing) => existing.root !== item['root']);
        layers.push(value as NonNullable<ArchitectureConfig['layers']>[number]);
        config.layers = layers;
      }
    }

    for (const rule of Array.isArray(from.block['forbidden']) ? (from.block['forbidden'] as unknown[]) : []) {
      const item = rule as Block;
      const to = strings(item?.['to']);
      if (typeof item?.['from'] !== 'string' || to.length === 0) continue;
      const value = { from: item['from'], to, ...(typeof item['why'] === 'string' ? { why: item['why'], source: from.source } : { source: from.source }) };
      const key = `forbidden:${item['from']}>${to.join(',')}`;
      if (!owner.has(key)) (config.forbidden ??= []).push(value);
      add(key, value, from);
    }
  }

  const seen = new Set<string>();
  const sources: RulesResolution['sources'] = [];
  for (const item of placed) {
    if (seen.has(item.source)) continue;
    seen.add(item.source);
    sources.push({ id: item.source, level: item.level });
  }

  return {
    config,
    rules,
    conflicts,
    problems,
    manifest: input.manifest ? 'ignored' : 'absent',
    sources
  };
}
