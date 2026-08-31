/**
 * Общие типы ядра. Кода здесь нет намеренно: тип записи и код нарушения —
 * часть контракта из docs/02-workspace-contract.md и docs/05-validation.md,
 * и им нужно одно место, а не копия в каждом модуле.
 */

/** Папка формата внутри проекта. Задана контрактом и не настраивается. */
export const DEVELOPMENT_DIR = 'docs/development';

export type RecordType =
  | 'requirement'
  | 'design'
  | 'decision'
  | 'contract'
  | 'task'
  | 'phase'
  | 'verification'
  | 'map';

export const RECORD_TYPES: readonly RecordType[] = [
  'requirement',
  'design',
  'decision',
  'contract',
  'task',
  'phase',
  'verification',
  'map'
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
  | 'diagrams'
  | 'maps';

export type LinkKind =
  | 'implements'
  | 'refines'
  | 'decided_by'
  | 'supersedes'
  | 'depends_on'
  | 'verified_by'
  | 'verifies'
  | 'documents'
  | 'covers'
  | 'affects';

export const LINK_KINDS: readonly LinkKind[] = [
  'implements',
  'refines',
  'decided_by',
  'supersedes',
  'depends_on',
  'verified_by',
  'verifies',
  'documents',
  'covers',
  'affects'
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
  | 'doc_link_missing'
  // карты
  | 'map_invalid'
  | 'map_evidence_missing'
  | 'map_evidence_stale'
  | 'map_drift'
  | 'task_maps_unapproved'
  | 'change_missing'
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

/** Префикс идентификатора по типу записи. Контракт, а не соглашение. */
export const PREFIX_BY_TYPE: Readonly<Record<RecordType, string>> = {
  requirement: 'R',
  design: 'D',
  decision: 'A',
  contract: 'C',
  task: 'T',
  phase: 'P',
  verification: 'V',
  map: 'M'
};

/** Раздел, в котором живёт тип. Имя папки берётся из манифеста, ключ — отсюда. */
export const SECTION_BY_TYPE: Readonly<Record<RecordType, SectionKey>> = {
  requirement: 'requirements',
  design: 'design',
  decision: 'decisions',
  contract: 'contracts',
  task: 'tasks',
  phase: 'phases',
  verification: 'tests',
  map: 'maps'
};

/** Что за изменение вносит задача (docs/02-workspace-contract.md). */
export type ChangeKind = 'feature' | 'fix' | 'rename' | 'format';

export const CHANGE_KINDS: readonly ChangeKind[] = ['feature', 'fix', 'rename', 'format'];

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
  doc_link_missing: 'warning',
  map_invalid: 'error',
  map_evidence_missing: 'error',
  map_evidence_stale: 'error',
  map_drift: 'error',
  task_maps_unapproved: 'error',
  change_missing: 'warning',
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
  sources?: { code?: string[]; docs?: string[]; client?: string[] };
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

/**
 * Формы ответов внутреннего API (docs/03-server-api.md). Браузер видит только
 * их: о путях и файлах он не знает.
 */

export interface VerificationOutcome {
  state: VerificationResult;
  /** Время начала прогона, из которого взят результат. */
  at: string;
  runner: string;
}

export interface IndexRecord {
  id: string;
  type: string;
  title: string;
  status: string;
  owner: string | null;
  created: string | null;
  updated: string | null;
  phase: string | null;
  tags: string[];
  path: string;
  section: SectionKey | null;
  links: Partial<Record<LinkKind, string[]>>;
  /** Обратные связи: в файлах их нет, их строит приложение. */
  backlinks: Partial<Record<LinkKind, string[]>>;
  /** Незнакомые поля front matter: приложение их не понимает, но обязано вернуть. */
  extra: Record<string, unknown>;
}

export interface IssueDto {
  severity: Severity;
  code: ViolationCode;
  recordId: string | null;
  path: string;
  message: string;
}

export interface ProjectIndex {
  project: { id: string; name: string; contract: string; roles: { id: string; name: string }[] };
  builtAt: string;
  /** Отпечаток файлов, по которому кэш понимает, что устарел. */
  fingerprint: string;
  records: IndexRecord[];
  verificationResults: Record<string, VerificationOutcome>;
  issues: IssueDto[];
}

/** Запись проекта в списке приложения — единственные собственные данные. */
export interface ProjectEntry {
  id: string;
  name: string;
  root: string;
  lastOpenedAt: string;
}

export interface DiagramBlock {
  /** `inline` — блок ```mermaid в тексте, `file` — вставленный .mmd. */
  kind: 'inline' | 'file';
  source: string;
  path?: string;
  caption?: string;
  error?: string;
}

export interface RecordAction {
  status: string;
  /** Подпись кнопки: слова для человека, а не имя статуса из контракта. */
  label: string;
  allowed: boolean;
  blockers: { code: string; message: string }[];
}

export interface MapClaimView {
  structure: string;
  side: 'added' | 'removed';
  label: string;
  path: string;
  line: number;
  /** `ok`, `missing`, `stale`, `still_present` или `pending` — сверять ещё рано. */
  verdict: string;
}

export interface MapView {
  problems: { structure: string; message: string }[];
  claims: MapClaimView[];
  /** Тексты mermaid не строим на сервере: экран рисует то, что уже сложил. */
  structures: string[];
}

export interface RecordDetail {
  record: IndexRecord;
  /** Тело документа в исходном markdown: приложение его не переписывает. */
  body: string;
  eol: Eol;
  diagrams: DiagramBlock[];
  actions: RecordAction[];
  /** Только у записей типа `map`. */
  map?: MapView;
  issues: IssueDto[];
  verifications: Record<string, VerificationOutcome>;
}
