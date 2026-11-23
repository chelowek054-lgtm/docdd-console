import type { Report, WorkRecord } from '../../types';

export interface MlStage {
  inputs: { name: string; format: string }[];
  outputs: { name: string; format: string }[];
  state: string;
  verifications?: string[];
}

export function stageMeasurements(stage: MlStage, reports: readonly Report[]) {
  return verificationRuns(stage.verifications ?? [], reports);
}

export function verificationRuns(ids: readonly string[], reports: readonly Report[]) {
  const verifications = new Set(ids);
  return reports.flatMap((report) => Object.entries(report.verifications)
    .filter(([id]) => verifications.has(id))
    .map(([id, result]) => ({
      id, result, run: report.run_id ?? report.started_at,
      at: report.started_at, note: report.note ?? '', measurements: report.measurements?.[id] ?? []
    }))).sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Markdown остаётся источником объяснений у прежних решений без структурированных экспериментов. */
function section(body: string, name: string): string {
  const lines = body.split(/\r?\n/);
  const from = lines.findIndex((line) => line.trim() === '## ' + name);
  if (from < 0) return '';
  const rest = lines.slice(from + 1);
  const end = rest.findIndex((line) => /^#{1,2}\s/.test(line));
  return rest.slice(0, end < 0 ? rest.length : end).join('\n').trim();
}

export function researchHistory(records: readonly WorkRecord[]) {
  const replaced = new Set(records.filter((record) => record.type === 'decision' && ['approved', 'superseded'].includes(record.status))
    .flatMap((record) => record.links.supersedes ?? []));
  return records.filter((record) => record.type === 'decision' && ['approved', 'superseded', 'rejected'].includes(record.status)).map((record) => ({
    id: record.id, title: record.title, status: replaced.has(record.id) ? 'superseded' : record.status,
    context: section(record.body, 'Контекст') || section(record.body, 'Вопрос'),
    options: section(record.body, 'Варианты'),
    outcome: section(record.body, 'Решение') || section(record.body, 'Как решить'),
    reason: section(record.body, 'Причина') || section(record.body, 'Последствия'),
    supersedes: record.links.supersedes ?? [],
    verifications: record.links.verified_by ?? []
  }));
}
