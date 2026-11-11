/**
 * Доменная карта (R-0119, A-0004): ограниченные контексты, их словарь и агрегаты,
 * связи между контекстами. Слой `domain` модуля: только понятия, без файлов и разбора.
 */

export const CONTEXT_KINDS = ['core', 'supporting', 'generic'] as const;
export type ContextKind = (typeof CONTEXT_KINDS)[number];

export const CONTEXT_RELATIONS = [
  'shared-kernel', 'customer-supplier', 'conformist', 'anticorruption-layer',
  'open-host', 'published-language', 'partnership', 'separate-ways'
] as const;
export type ContextRelationKind = (typeof CONTEXT_RELATIONS)[number];

/** Слои чистой архитектуры сверху вниз: импорт идёт только вниз, к `domain`. */
export const CLEAN_LAYERS = ['interface', 'infrastructure', 'application', 'domain'] as const;

export interface Term {
  term: string;
  meaning?: string;
  code?: string;
}

export interface DomainContext {
  id: string;
  title?: string;
  kind?: ContextKind;
  root?: string;
  summary?: string;
  capabilities?: string[];
  language?: Term[];
  declaredBy?: string;
}

export interface DomainAggregate {
  id: string;
  context?: string;
  title?: string;
  root?: string;
  invariants?: string[];
  entities?: string[];
  valueObjects?: string[];
  policies?: string[];
  events?: string[];
  path?: string;
  declaredBy?: string;
}

export interface ContextRelation {
  from: string;
  to: string;
  kind: ContextRelationKind;
  summary?: string;
  declaredBy?: string;
}

export interface DomainPart {
  contexts?: DomainContext[];
  aggregates?: DomainAggregate[];
  relations?: ContextRelation[];
}

/** Сложенная доменная карта проекта. */
export interface DomainState {
  contexts: DomainContext[];
  aggregates: DomainAggregate[];
  relations: ContextRelation[];
}

export const emptyDomain = (): DomainState => ({ contexts: [], aggregates: [], relations: [] });

/** Области, где решает только архитектор (R-0120). */
export const ARCHITECT_AREAS = ['topology', 'storage', 'transactions'] as const;
export type ArchitectArea = (typeof ARCHITECT_AREAS)[number];

export const AREA_TITLE: Readonly<Record<ArchitectArea, string>> = {
  topology: 'топология (монолит, модульный монолит, микросервисы)',
  storage: 'хранение данных',
  transactions: 'транзакции'
};

export const isArchitectArea = (value: unknown): value is ArchitectArea =>
  typeof value === 'string' && (ARCHITECT_AREAS as readonly string[]).includes(value);

/** Путь под корнем — по границе сегмента: `src/order` не захватывает `src/orders`. */
export function underRoot(path: string, root: string): boolean {
  const clean = root.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+$/, '');
  const target = path.replace(/\\/g, '/').replace(/^\.\//, '');
  return clean !== '' && (target === clean || target.startsWith(`${clean}/`));
}
