import { checkArchitecture, type ArchCode } from '../lib/architecture';
import { reconcileCapabilities, type CapabilityReconcile } from '../lib/architecture-capabilities';
import { buildProjectMap } from './map-service';
import { readWorkspace } from '../lib/workspace';
import { resolveProjectRules } from './rules-service';

/**
 * Нарушения архитектуры по подтверждённой карте кода и правилам `architecture`
 * манифеста (docs/03-server-api.md, `GET /architecture`). Производное: нигде не
 * хранится, считается заново на каждый запрос.
 */

export interface ArchitectureReport {
  /** Секции `architecture` нет — это состояние, а не ошибка: экран зовёт её добавить. */
  enabled: boolean;
  modules?: { id: string; entry: string | null; parent: string | null; language: string }[];
  findings?: {
    code: ArchCode;
    from: string;
    to: string;
    evidence?: { path: string; line: number; fragment: string } | undefined;
    map?: string | undefined;
    message: string;
  }[];
  checked?: number;
  total?: number;
  unchecked?: Record<string, number>;
  /** Сверка модулей с функциональной картой: замечания, а не нарушения. */
  reconcile?: CapabilityReconcile;
}

export function buildArchitecture(root: string): ArchitectureReport {
  const workspace = readWorkspace(root);
  const config = resolveProjectRules(root).config;
  if (!config) return { enabled: false };

  const { codemap, functional } = buildProjectMap(root);
  const result = checkArchitecture({
    config,
    files: workspace.codeFiles,
    modules: codemap.modules,
    imports: codemap.imports
  });

  return {
    enabled: true,
    modules: result.modules.map((module) => ({ id: module.dir, entry: module.entry, parent: module.parent, language: module.language })),
    findings: result.findings.map((finding) => ({
      code: finding.code,
      from: finding.from,
      to: finding.to,
      evidence: finding.evidence,
      map: finding.declaredBy,
      message: finding.message
    })),
    checked: result.checked,
    total: result.total,
    unchecked: result.unchecked,
    reconcile: reconcileCapabilities({
      modules: result.modules,
      mapModules: codemap.modules,
      groups: codemap.groups,
      capabilities: functional.capabilities
    })
  };
}
