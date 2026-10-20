import type { ProjectIndex } from './types';

/**
 * Метрики процесса в текстовом формате Prometheus (R-0065). Своей базы нет:
 * значения считаются из индекса при каждом запросе, историю хранит Prometheus.
 */
export function prometheusMetrics(index: Pick<ProjectIndex, 'records' | 'issues' | 'verificationResults'>, project: string): string {
  const label = (value: string) => value.split(String.fromCharCode(92)).join(String.fromCharCode(92, 92)).split('"').join(String.fromCharCode(92) + '"').split(String.fromCharCode(10)).join(String.fromCharCode(92) + 'n');
  const p = `project="${label(project)}"`;
  const out: string[] = [];

  out.push('# HELP docdd_tasks Задачи проекта по статусам.', '# TYPE docdd_tasks gauge');
  const byStatus = new Map<string, number>();
  for (const record of index.records) {
    if (record.type === 'task') byStatus.set(record.status, (byStatus.get(record.status) ?? 0) + 1);
  }
  for (const [status, count] of [...byStatus].sort(([a], [b]) => a.localeCompare(b))) {
    out.push(`docdd_tasks{${p},status="${label(status)}"} ${count}`);
  }

  out.push('# HELP docdd_issues Нарушения контракта по серьёзности.', '# TYPE docdd_issues gauge');
  for (const severity of ['error', 'warning']) {
    out.push(`docdd_issues{${p},severity="${severity}"} ${index.issues.filter((issue) => issue.severity === severity).length}`);
  }

  // Доля — только по проверкам, у которых есть прогон: «не прогонялась» не считается провалом.
  const results = Object.values(index.verificationResults);
  const decided = results.filter((result) => result.state !== 'skipped');
  const passed = decided.filter((result) => result.state === 'passed').length;
  out.push('# HELP docdd_verifications Проверки по последнему результату.', '# TYPE docdd_verifications gauge');
  for (const state of ['passed', 'failed', 'skipped']) {
    out.push(`docdd_verifications{${p},state="${state}"} ${results.filter((result) => result.state === state).length}`);
  }
  out.push('# HELP docdd_verifications_passed_ratio Доля пройденных проверок среди прогнанных (0..1).', '# TYPE docdd_verifications_passed_ratio gauge');
  out.push(`docdd_verifications_passed_ratio{${p}} ${decided.length ? passed / decided.length : 0}`);
  return out.join('\n') + '\n';
}

/** Алерт Grafana (webhook) — в текст заметки для входящего. */
export function alertNote(payload: unknown): { title: string; body: string } {
  const root = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>;
  const alerts = Array.isArray(root['alerts']) ? (root['alerts'] as Record<string, unknown>[]) : [];
  const str = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
  const first = (alerts[0] ?? {}) as Record<string, Record<string, unknown> | undefined>;
  const name = str(first['labels']?.['alertname']) || str(root['title']) || 'Алерт Grafana';
  const lines = alerts.map((alert) => {
    const a = alert as Record<string, Record<string, unknown> | string | undefined>;
    const annotations = (typeof a['annotations'] === 'object' ? a['annotations'] : {}) as Record<string, unknown>;
    const text = str(annotations['summary']) || str(annotations['description']);
    return `- ${str(a['status']) || 'firing'}: ${str((typeof a['labels'] === 'object' ? a['labels'] : {} as Record<string, unknown>)?.['alertname']) || name}${text ? ` — ${text}` : ''}${str(a['generatorURL']) ? ` (${str(a['generatorURL'])})` : ''}`;
  });
  const message = str(root['message']);
  const body = [message, ...lines].filter(Boolean).join('\n') || 'Алерт пришёл без подробностей.';
  return { title: `Алерт: ${name}`.slice(0, 120), body: `Инцидент для сопровождения (Grafana).\n\n${body}` };
}

/** Значение из ответа Prometheus `/api/v1/query`: первый элемент вектора или скаляр. */
export function prometheusValue(payload: unknown): number | null {
  const data = (payload as { data?: { resultType?: string; result?: unknown } } | null)?.data;
  if (!data) return null;
  const pair = data.resultType === 'scalar'
    ? data.result
    : data.resultType === 'vector' && Array.isArray(data.result) ? (data.result[0] as { value?: unknown } | undefined)?.value : null;
  const raw = Array.isArray(pair) ? pair[1] : null;
  const value = typeof raw === 'string' || typeof raw === 'number' ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : null;
}

/** По умолчанию значение не должно превышать порог (ошибки, задержки); `gte` — наоборот (доступность). */
export function passesThreshold(value: number, threshold: number, operator: unknown): boolean {
  return operator === 'gte' ? value >= threshold : value <= threshold;
}
