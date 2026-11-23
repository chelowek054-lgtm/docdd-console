import { isSafeRelative } from '../../design-export';
import { RETIRED_STATUSES, type WorkRecord } from '../../types';
import type { DevelopmentStandard } from '../domain/model';

export interface DesignWarning {
  code: 'standard_config_missing' | 'standard_coverage_low' | 'quality_unmeasured';
  location: string;
  detail: string;
}

export function standardWarnings(standards: readonly DevelopmentStandard[], read: (path: string) => string | null): DesignWarning[] {
  const warnings: DesignWarning[] = [];
  const readLocal = (path: string) => isSafeRelative(path) ? read(path) : null;
  for (const standard of standards) {
    for (const config of standard.configs) {
      if (readLocal(config) === null) warnings.push({ code: 'standard_config_missing', location: standard.id, detail: config });
    }
    if (standard.coverage_min === undefined || !standard.coverage_report) continue;
    const raw = readLocal(standard.coverage_report);
    let actual: unknown;
    try {
      actual = raw ? JSON.parse(raw)?.total?.lines?.pct : undefined;
    } catch {
      // Незавершённый отчёт тоже не подтверждает порог.
    }
    if (typeof actual !== 'number' || !Number.isFinite(actual) || actual > 100 || actual < standard.coverage_min) {
      warnings.push({ code: 'standard_coverage_low', location: standard.id, detail: standard.coverage_report + ' · ≥ ' + standard.coverage_min + '%' });
    }
  }
  return warnings;
}

export function qualityWarnings(records: readonly WorkRecord[]): DesignWarning[] {
  const live = records.filter((item) => !RETIRED_STATUSES.has(item.status));
  const metrics = live.filter((item) => item.type === 'verification' && item.data['kind'] === 'metric');
  return live.filter((item) => item.type === 'requirement' && item.data['quality'] && !metrics.some((metric) =>
    metric.links.verifies?.includes(item.id) || item.links.verified_by?.includes(metric.id)
  )).map((item) => ({ code: 'quality_unmeasured', location: item.source.path, detail: item.id }));
}
