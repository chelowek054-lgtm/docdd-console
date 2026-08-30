import { buildGraph, type Graph } from './graph';
import { parseRecord } from './parse';
import { latestVerificationResults } from './reports';
import { checkAll, checkRecordIdentity, type RuleContext } from './rules';
import { validateFrontMatter, type SchemaIssue } from './schema';
import {
  violation,
  type ProjectManifest,
  type RecordSource,
  type Report,
  type Violation,
  type WorkRecord
} from './types';

export interface SourceFile {
  text: string;
  source: RecordSource;
}

export interface AnalyzeInput {
  files: readonly SourceFile[];
  manifest?: ProjectManifest;
  /** Уже разобранные отчёты: файлы читает фаза 4, схема проверяет их отдельно. */
  reports?: readonly Report[];
  /** Существующие файлы кода относительно корня проекта. */
  codeFiles?: Iterable<string>;
  now?: Date;
}

export interface AnalyzeResult {
  records: WorkRecord[];
  graph: Graph;
  violations: Violation[];
}

/**
 * Полный проход: разбор → схема → связи → правила. Порядок из
 * docs/05-validation.md, и ошибка на одном файле не останавливает остальные —
 * иначе одна опечатка гасила бы весь проект.
 */
export function analyze(input: AnalyzeInput): AnalyzeResult {
  const records: WorkRecord[] = [];
  const violations: Violation[] = [];

  for (const file of input.files) {
    const outcome = parseRecord(file.text, file.source);
    if (!outcome.ok) {
      violations.push(outcome.violation);
      continue;
    }
    const record = outcome.record;
    records.push(record);

    const identity = checkRecordIdentity(record);
    violations.push(...identity);
    violations.push(...schemaViolations(record, identity));
  }

  const graph = buildGraph(records);
  const ctx: RuleContext = {
    records,
    graph,
    policy: input.manifest?.policy ?? {},
    verifications: latestVerificationResults(input.reports ?? []),
    now: input.now ?? new Date(),
    code: {
      roots: input.manifest?.sources?.code ?? [],
      files: new Set(input.codeFiles ?? [])
    }
  };
  violations.push(...checkAll(ctx));

  return { records, graph, violations: sortViolations(violations) };
}

/**
 * Схема сообщает о том, о чём ещё не сказали более точные коды: ошибка на
 * `type` при незнакомом типе и на `id` при несоответствии типу подавляется,
 * иначе человек получает два пункта об одной беде.
 */
function schemaViolations(record: WorkRecord, identity: readonly Violation[]): Violation[] {
  const codes = new Set(identity.map((item) => item.code));
  const issues = validateFrontMatter(record.data).filter((issue) => !suppressed(issue, codes));
  return issues.map((issue) => violation(
    'schema_invalid',
    record.id || null,
    record.source.path,
    issue.message
  ));
}

function suppressed(issue: SchemaIssue, codes: ReadonlySet<string>): boolean {
  if (issue.instancePath === '/type' && codes.has('unknown_type')) return true;
  if (issue.instancePath === '/id' && codes.has('id_mismatch')) return true;
  return false;
}

/** Порядок предсказуемый: список нарушений сравнивается в тестах целиком. */
function sortViolations(violations: readonly Violation[]): Violation[] {
  return [...violations].sort((a, b) =>
    a.path.localeCompare(b.path)
    || a.code.localeCompare(b.code)
    || a.message.localeCompare(b.message));
}
