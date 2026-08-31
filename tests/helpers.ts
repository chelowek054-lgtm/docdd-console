import { buildGraph } from '../server/lib/graph';
import type { RuleContext } from '../server/lib/rules';
import type {
  LinkKind,
  Policy,
  SectionKey,
  VerificationResult,
  Violation,
  WorkRecord
} from '../server/lib/types';

const SECTION_BY_TYPE: Record<string, SectionKey> = {
  requirement: 'requirements',
  design: 'design',
  decision: 'decisions',
  contract: 'contracts',
  task: 'tasks',
  phase: 'phases',
  verification: 'tests'
};

export interface RecordOptions {
  links?: Partial<Record<LinkKind, string[]>>;
  title?: string;
  body?: string;
  created?: string;
  updated?: string;
  path?: string;
  section?: SectionKey | null;
  extra?: Record<string, unknown>;
}

/** Запись собирается в памяти: правила не знают ни файлов, ни путей — только данные. */
export function rec(id: string, type: string, status: string, options: RecordOptions = {}): WorkRecord {
  const title = options.title ?? `Запись ${id}`;
  const created = options.created ?? '2026-08-01';
  const updated = options.updated ?? '2026-08-01';
  const section = options.section === null
    ? undefined
    : options.section ?? SECTION_BY_TYPE[type];
  const path = options.path ?? `docs/development/${section ?? 'misc'}/${id}-zapis.md`;

  const data: Record<string, unknown> = {
    id,
    type,
    title,
    status,
    created,
    updated,
    ...(options.links ? { links: options.links } : {}),
    ...options.extra
  };

  return {
    id,
    type,
    status,
    title,
    data,
    links: options.links ?? {},
    body: options.body ?? `# ${title}\n`,
    eol: 'lf',
    source: section ? { path, section } : { path }
  };
}

export interface ContextOptions {
  policy?: Policy;
  verifications?: Record<string, VerificationResult>;
  now?: string;
  codeRoots?: string[];
  codeFiles?: string[];
  documents?: string[];
}

export function context(records: WorkRecord[], options: ContextOptions = {}): RuleContext {
  return {
    records,
    graph: buildGraph(records),
    policy: options.policy ?? {},
    verifications: new Map(Object.entries(options.verifications ?? {})),
    now: new Date(`${options.now ?? '2026-08-30'}T12:00:00Z`),
    code: {
      roots: options.codeRoots ?? [],
      files: new Set(options.codeFiles ?? [])
    },
    // По умолчанию существующими считаются файлы самих записей: так тест
    // проверяет правило, а не список файлов.
    documents: new Set(options.documents ?? records.map((record) => record.source.path))
  };
}

export function codes(violations: readonly Violation[]): string[] {
  return violations.map((item) => item.code).sort();
}

export function pairs(violations: readonly Violation[]): string[] {
  return violations.map((item) => `${item.code} ${item.id ?? item.path}`).sort();
}
