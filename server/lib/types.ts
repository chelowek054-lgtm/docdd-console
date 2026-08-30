/**
 * Общие типы ядра. Кода здесь нет намеренно: тип записи и код нарушения —
 * часть контракта из docs/02-workspace-contract.md и docs/05-validation.md,
 * и им нужно одно место, а не копия в каждом модуле.
 */

export type RecordType =
  | 'requirement'
  | 'design'
  | 'decision'
  | 'contract'
  | 'task'
  | 'phase'
  | 'verification';

export const RECORD_TYPES: readonly RecordType[] = [
  'requirement',
  'design',
  'decision',
  'contract',
  'task',
  'phase',
  'verification'
];

/** Ключ раздела из `paths` манифеста. Имена папок в код не зашиваются. */
export type SectionKey =
  | 'requirements'
  | 'design'
  | 'decisions'
  | 'contracts'
  | 'tasks'
  | 'phases'
  | 'tests'
  | 'diagrams';

export type LinkKind =
  | 'implements'
  | 'refines'
  | 'decided_by'
  | 'supersedes'
  | 'depends_on'
  | 'verified_by'
  | 'verifies'
  | 'documents'
  | 'covers';

export const LINK_KINDS: readonly LinkKind[] = [
  'implements',
  'refines',
  'decided_by',
  'supersedes',
  'depends_on',
  'verified_by',
  'verifies',
  'documents',
  'covers'
];

export type Severity = 'error' | 'warning';

export type ViolationCode =
  // разбор и схема
  | 'parse_failed'
  | 'schema_invalid'
  | 'id_mismatch'
  | 'id_duplicate'
  | 'title_mismatch'
  | 'unknown_type'
  // связи
  | 'link_broken'
  | 'link_cycle'
  | 'link_wrong_type'
  | 'superseded_without_successor'
  | 'code_link_missing'
  // процесс
  | 'task_not_ready_docs'
  | 'task_no_requirement'
  | 'task_done_unverified'
  | 'transition_forbidden'
  | 'requirement_unverified'
  | 'requirement_unimplemented'
  | 'doc_changed_after_task'
  | 'task_stale'
  | 'verification_never_run';

/** Уровень задан контрактом, а не вызывающим кодом: см. таблицы 05-validation.md. */
export const VIOLATION_LEVELS: Readonly<Record<ViolationCode, Severity>> = {
  parse_failed: 'error',
  schema_invalid: 'error',
  id_mismatch: 'error',
  id_duplicate: 'error',
  title_mismatch: 'warning',
  unknown_type: 'warning',
  link_broken: 'error',
  link_cycle: 'error',
  link_wrong_type: 'error',
  superseded_without_successor: 'error',
  code_link_missing: 'warning',
  task_not_ready_docs: 'error',
  task_no_requirement: 'error',
  task_done_unverified: 'error',
  transition_forbidden: 'error',
  requirement_unverified: 'warning',
  requirement_unimplemented: 'warning',
  doc_changed_after_task: 'warning',
  task_stale: 'warning',
  verification_never_run: 'warning'
};

export interface Violation {
  code: ViolationCode;
  level: Severity;
  /** Идентификатор записи; null, если файл не разобрался и идентификатора нет. */
  id: string | null;
  /** Путь к файлу относительно корня проекта: без него нарушение нечем открыть. */
  path: string;
  /** Объяснение по-русски: что не так и что сделать. */
  message: string;
}

/** Откуда пришло содержимое. Данные, а не доступ к файловой системе. */
export interface RecordSource {
  path: string;
  /** Раздел вычисляет вызывающая сторона по `paths` манифеста. */
  section?: SectionKey;
}

export type Eol = 'lf' | 'crlf';

export interface WorkRecord {
  id: string;
  /** Строка, а не RecordType: незнакомый тип — предупреждение, а не отказ. */
  type: string;
  status: string;
  title: string;
  /** Front matter целиком, включая незнакомые поля: они сохраняются при записи. */
  data: Readonly<Record<string, unknown>>;
  links: Readonly<Partial<Record<LinkKind, readonly string[]>>>;
  body: string;
  eol: Eol;
  source: RecordSource;
}

export type VerificationResult = 'passed' | 'failed' | 'skipped';

export interface Report {
  contract: string;
  runner: string;
  started_at: string;
  total?: number;
  failed?: number;
  verifications: Record<string, VerificationResult>;
}

export interface Policy {
  require_approved_docs_before_dev?: boolean;
  require_verification_before_done?: boolean;
  stale_in_progress_days?: number;
}

export interface ProjectManifest {
  contract: string;
  project: { id: string; name: string; description?: string };
  paths: Partial<Record<SectionKey, string>>;
  sources?: { code?: string[]; docs?: string[] };
  roles?: { id: string; name: string }[];
  policy?: Policy;
}

/** Умолчания политики повторяют `default` из project.schema.json. */
export const DEFAULT_POLICY: Required<Pick<Policy, 'require_approved_docs_before_dev' | 'require_verification_before_done'>> = {
  require_approved_docs_before_dev: true,
  require_verification_before_done: true
};

export function violation(
  code: ViolationCode,
  id: string | null,
  path: string,
  message: string
): Violation {
  return { code, level: VIOLATION_LEVELS[code], id, path, message };
}
