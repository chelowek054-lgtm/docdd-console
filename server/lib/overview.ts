import { RETIRED_STATUSES, type IndexRecord, type IssueDto, type VerificationOutcome } from './types';
import { phaseDue } from './timing';

/**
 * Обзор проекта (docs/04-ui.md, «Обзор»): готово ли обещанное, что в проде, что
 * делается и проверяется. Чистая функция над индексом — экран только рисует.
 */

export interface Share { done: number; total: number; percent: number }

export interface RequirementsOverview extends Share { inWork: number; noTasks: number }

export interface ChecksOverview extends Share {
  auto: { passed: number; failed: number; total: number };
  manual: { passed: number; failed: number; total: number };
  failed: number;
  neverRun: number;
}

export type PhaseStage = 'prod' | 'stage' | 'review' | 'development' | 'not_started' | 'closed';

export interface PhaseRow {
  id: string;
  title: string;
  done: number;
  total: number;
  percent: number;
  inProgress: number;
  inReview: number;
  stage: PhaseStage;
  environments: string[];
  target: string | null;
  overdueDays: number | null;
}

export interface ReleaseRow { id: string; version: string; environments: string[]; tasks: number; updated: string | null }

export interface RunRow { runner: string; at: string; passed: number; failed: number }

export interface ManualRow { id: string; title: string; by: string; note: string; at: string; state: string }

export interface Risk { kind: 'overdue' | 'unverified_requirement' | 'stale' | 'no_requirement' | 'failed_check'; id: string; title: string; detail: string }

export interface Overview {
  requirements: RequirementsOverview;
  tasks: Share & { byStatus: Record<string, number> };
  checks: ChecksOverview;
  phases: PhaseRow[];
  releases: ReleaseRow[];
  lastAutoRun: RunRow | null;
  manual: ManualRow[];
  issues: { errors: number; warnings: number; top: { code: string; count: number }[] };
  risks: Risk[];
}

const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'in_review', 'done', 'dropped', 'legacy'] as const;

function share(done: number, total: number): Share {
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

function list(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

const isManual = (outcome: VerificationOutcome | undefined) => !!outcome && outcome.runner.startsWith('manual');
const isProd = (environment: string) => /prod/i.test(environment);

function daysBetween(from: string, to: Date): number {
  return Math.floor((to.getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

export function buildOverview(
  records: readonly IndexRecord[],
  results: Readonly<Record<string, VerificationOutcome>>,
  issues: readonly IssueDto[],
  now: Date = new Date()
): Overview {
  const byId = new Map(records.map((record) => [record.id, record]));
  const tasks = records.filter((record) => record.type === 'task' && record.status !== 'dropped' && record.status !== 'legacy');
  const checks = records.filter((record) => record.type === 'verification' && !RETIRED_STATUSES.has(record.status));
  const requirements = records.filter((record) => record.type === 'requirement' && record.status !== 'rejected' && record.status !== 'superseded');
  const releases = records.filter((record) => record.type === 'release');

  // Проверки требования объявляют с любой стороны: verified_by у требования или verifies у проверки.
  const checksOf = (requirementId: string) => {
    const ids = new Set(byId.get(requirementId)?.links.verified_by ?? []);
    for (const check of checks) if ((check.links.verifies ?? []).includes(requirementId)) ids.add(check.id);
    return [...ids].filter((id) => byId.has(id));
  };
  const tasksOf = (requirementId: string) => tasks.filter((task) => (task.links.implements ?? []).includes(requirementId));

  let implemented = 0;
  let inWork = 0;
  let noTasks = 0;
  const risks: Risk[] = [];
  for (const requirement of requirements) {
    const own = tasksOf(requirement.id);
    const ownChecks = checksOf(requirement.id);
    if (!own.length) noTasks += 1;
    else if (own.some((task) => task.status !== 'done')) inWork += 1;
    const checked = ownChecks.length > 0 && ownChecks.every((id) => results[id]?.state === 'passed');
    if (own.length && own.every((task) => task.status === 'done') && checked) implemented += 1;
    if (!ownChecks.length && requirement.status === 'approved') {
      risks.push({ kind: 'unverified_requirement', id: requirement.id, title: requirement.title, detail: 'нет проверки' });
    }
  }

  const byStatus = Object.fromEntries(TASK_STATUSES.map((status) => [status, 0])) as Record<string, number>;
  for (const task of records.filter((record) => record.type === 'task')) byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;

  const auto = { passed: 0, failed: 0, total: 0 };
  const manual = { passed: 0, failed: 0, total: 0 };
  let passed = 0;
  let failed = 0;
  let neverRun = 0;
  for (const check of checks) {
    const outcome = results[check.id];
    if (!outcome) { neverRun += 1; continue; }
    const bucket = isManual(outcome) ? manual : auto;
    bucket.total += 1;
    if (outcome.state === 'passed') { bucket.passed += 1; passed += 1; }
    if (outcome.state === 'failed') {
      bucket.failed += 1;
      failed += 1;
      risks.push({ kind: 'failed_check', id: check.id, title: check.title, detail: `не прошла · ${outcome.runner}` });
    }
  }

  // Где задача выложена: окружения релизов, которые её отгрузили (связь ships).
  const shippedTo = new Map<string, Set<string>>();
  for (const release of releases) {
    for (const taskId of release.links.ships ?? []) {
      const set = shippedTo.get(taskId) ?? new Set<string>();
      for (const environment of list(release.extra['environments'])) set.add(environment);
      shippedTo.set(taskId, set);
    }
  }

  const phases: PhaseRow[] = records.filter((record) => record.type === 'phase').map((phase) => {
    const own = (phase.links.covers ?? []).map((id) => byId.get(id)).filter((task): task is IndexRecord => !!task && task.type === 'task' && task.status !== 'dropped' && task.status !== 'legacy');
    const done = own.filter((task) => task.status === 'done');
    const inProgress = own.filter((task) => task.status === 'in_progress').length;
    const inReview = own.filter((task) => task.status === 'in_review').length;
    const environments = new Set<string>();
    let allShipped = done.length > 0;
    let allProd = done.length > 0;
    for (const task of done) {
      const set = shippedTo.get(task.id);
      if (!set?.size) { allShipped = false; allProd = false; continue; }
      for (const environment of set) environments.add(environment);
      if (![...set].some(isProd)) allProd = false;
    }
    // Порядок важен: выложено в прод — главный факт, дальше «закрыта», затем то, что ещё в руках.
    let stage: PhaseStage;
    if (allProd) stage = 'prod';
    else if (allShipped) stage = 'stage';
    else if (own.length && done.length === own.length) stage = 'closed';
    else if (inReview) stage = 'review';
    else if (inProgress || done.length) stage = 'development';
    else stage = 'not_started';
    const target = phaseDue(phase.extra);
    const finished = own.length > 0 && done.length === own.length;
    const late = target && !finished ? daysBetween(target, now) : null;
    const overdueDays = late !== null && late > 0 ? late : null;
    if (overdueDays) risks.push({ kind: 'overdue', id: phase.id, title: phase.title, detail: `просрочена на ${overdueDays} дн.` });
    return { id: phase.id, title: phase.title, ...share(done.length, own.length), inProgress, inReview, stage, environments: [...environments].sort(), target, overdueDays };
  });

  for (const issue of issues) {
    if (issue.code === 'task_stale' && issue.recordId) risks.push({ kind: 'stale', id: issue.recordId, title: byId.get(issue.recordId)?.title ?? issue.recordId, detail: 'зависла' });
    if (issue.code === 'task_no_requirement' && issue.recordId) risks.push({ kind: 'no_requirement', id: issue.recordId, title: byId.get(issue.recordId)?.title ?? issue.recordId, detail: 'без требования' });
  }

  // Последний прогон автотестов — по самому позднему результату не-ручного раннера.
  const autoOutcomes = Object.values(results).filter((outcome) => !isManual(outcome));
  const lastAt = autoOutcomes.map((outcome) => outcome.at).sort().at(-1);
  const lastRun = lastAt ? autoOutcomes.filter((outcome) => outcome.at === lastAt) : [];
  const lastAutoRun: RunRow | null = lastAt
    ? { runner: lastRun[0]!.runner, at: lastAt, passed: lastRun.filter((outcome) => outcome.state === 'passed').length, failed: lastRun.filter((outcome) => outcome.state === 'failed').length }
    : null;

  const manualRows: ManualRow[] = checks
    .map((check) => ({ check, outcome: results[check.id] }))
    .filter((row): row is { check: IndexRecord; outcome: VerificationOutcome } => isManual(row.outcome))
    .sort((a, b) => b.outcome.at.localeCompare(a.outcome.at))
    .slice(0, 6)
    .map(({ check, outcome }) => ({ id: check.id, title: check.title, by: outcome.checkedBy ?? outcome.runner.replace(/^manual:/, ''), note: outcome.note ?? '', at: outcome.at, state: outcome.state }));

  const codes = new Map<string, number>();
  for (const issue of issues) codes.set(issue.code, (codes.get(issue.code) ?? 0) + 1);

  return {
    requirements: { ...share(implemented, requirements.length), inWork, noTasks },
    tasks: { ...share(tasks.filter((task) => task.status === 'done').length, tasks.length), byStatus },
    checks: { ...share(passed, checks.length), auto, manual, failed, neverRun },
    phases,
    releases: releases
      .map((release) => ({ id: release.id, version: String(release.extra['version'] ?? release.title), environments: list(release.extra['environments']), tasks: (release.links.ships ?? []).length, updated: release.updated }))
      .sort((a, b) => (b.updated ?? '').localeCompare(a.updated ?? ''))
      .slice(0, 5),
    lastAutoRun,
    manual: manualRows,
    issues: {
      errors: issues.filter((issue) => issue.severity === 'error').length,
      warnings: issues.filter((issue) => issue.severity === 'warning').length,
      top: [...codes].map(([code, count]) => ({ code, count })).sort((a, b) => b.count - a.count).slice(0, 5)
    },
    risks: risks.slice(0, 12)
  };
}
