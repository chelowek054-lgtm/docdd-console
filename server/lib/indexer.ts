import { analyze } from './analyze';
import { incomingEdges } from './graph';
import { latestVerificationDetails } from './reports';
import type {
  IndexRecord,
  IssueDto,
  LinkKind,
  ProjectIndex,
  VerificationOutcome,
  WorkRecord
} from './types';
import { LINK_KINDS } from './types';
import { readWorkspace, sourceReader, type Workspace } from './workspace';
import { recordOfBranch } from './branch';
import { hasChangesSync, workBranchesSync } from '../utils/git';

/** Поля, которые понимает контракт; всё остальное уходит в `extra` нетронутым. */
const KNOWN_FIELDS = new Set(['id', 'type', 'title', 'status', 'owner', 'created', 'updated', 'phase', 'tags', 'links']);

/**
 * Ветки и неразобранные изменения задач. Отказ git не помеха: без этих данных
 * два предупреждения просто не выставляются, а индекс собирается как раньше.
 */
function workState(root: string): { unreviewed: Set<string>; orphanBranches: Set<string> } {
  const orphanBranches = new Set<string>();
  const unreviewed = new Set<string>();
  for (const branch of workBranchesSync(root)) {
    const id = recordOfBranch(branch);
    if (!id) continue;
    orphanBranches.add(id);
    if (hasChangesSync(root, id)) unreviewed.add(id);
  }
  return { unreviewed, orphanBranches };
}

/**
 * Индекс — результат прохода: записи, связи, нарушения, время сборки.
 * Форма ответа задана docs/03-server-api.md.
 */
export function buildIndex(root: string, now = new Date()): { index: ProjectIndex; workspace: Workspace } {
  const workspace = readWorkspace(root);
  const result = analyze({
    files: workspace.files,
    manifest: workspace.manifest,
    reports: workspace.reports,
    codeFiles: workspace.codeFiles,
    // Сверка свидетельств карт читает файлы проекта — по одному и по требованию.
    readSource: sourceReader(root),
    // Состояние работы: ветки и деревья задач. Git смотрим здесь, чтобы правила
    // остались чистыми функциями над данными.
    work: workState(root),
    now
  });

  const verificationResults: Record<string, VerificationOutcome> = {};
  for (const [id, outcome] of latestVerificationDetails(workspace.reports)) {
    verificationResults[id] = outcome;
  }

  const records: IndexRecord[] = result.records.map((record) => toIndexRecord(record, result.graph));
  const issues: IssueDto[] = result.violations.map((violation) => ({
    severity: violation.level,
    code: violation.code,
    recordId: violation.id,
    path: violation.path,
    message: violation.message
  }));

  return {
    workspace,
    index: {
      project: {
        id: workspace.manifest.project.id,
        name: workspace.manifest.project.name,
        contract: workspace.manifest.contract,
        // Роль — подпись в журнале, а не доступ: экрану нужен их список.
        roles: workspace.manifest.roles ?? []
      },
      builtAt: now.toISOString(),
      fingerprint: workspace.fingerprint,
      records,
      verificationResults,
      issues
    }
  };
}

function toIndexRecord(record: WorkRecord, graph: Parameters<typeof incomingEdges>[0]): IndexRecord {
  const extra: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record.data)) {
    if (!KNOWN_FIELDS.has(key)) extra[key] = value;
  }

  const links: Partial<Record<LinkKind, string[]>> = {};
  const backlinks: Partial<Record<LinkKind, string[]>> = {};
  for (const kind of LINK_KINDS) {
    const out = record.links[kind];
    if (out && out.length > 0) links[kind] = [...out];
    // Обратные связи в файлах не хранятся — их строит приложение.
    const back = record.id ? incomingEdges(graph, record.id, kind).map((edge) => edge.from) : [];
    if (back.length > 0) backlinks[kind] = back;
  }

  return {
    id: record.id,
    type: record.type,
    title: record.title,
    status: record.status,
    owner: stringOrNull(record.data['owner']),
    created: stringOrNull(record.data['created']),
    updated: stringOrNull(record.data['updated']),
    phase: stringOrNull(record.data['phase']),
    tags: Array.isArray(record.data['tags'])
      ? (record.data['tags'] as unknown[]).filter((tag): tag is string => typeof tag === 'string')
      : [],
    path: record.source.path,
    section: record.source.section ?? null,
    links,
    backlinks,
    extra
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}
