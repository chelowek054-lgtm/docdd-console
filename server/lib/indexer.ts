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
import { readWorkspace, type Workspace } from './workspace';

/** Поля, которые понимает контракт; всё остальное уходит в `extra` нетронутым. */
const KNOWN_FIELDS = new Set(['id', 'type', 'title', 'status', 'owner', 'created', 'updated', 'phase', 'tags', 'links']);

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
        contract: workspace.manifest.contract
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
