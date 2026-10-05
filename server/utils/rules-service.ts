import { analyze } from '../lib/analyze';
import { withBuiltin } from '../lib/builtin';
import { normalizeRoot } from '../lib/paths';
import { resolveRules, type RuleRecord, type RulesResolution } from '../lib/practice-rules';
import type { SharedSource } from '../lib/types';
import { readManifest, readWorkspace } from '../lib/workspace';
import { sourceRoot } from './source-root';

/**
 * Правила проверки из практик (docs/12-practice-rules.md, ADR-0014). Общие
 * практики читаются из источников `sources.shared` как из своих корней; здесь
 * источник разбирается без `loadIndex`, чтобы цепочка источников не уходила
 * в рекурсию: источник, подключающий проект, который подключает его самого,
 * не должен зависать.
 */

/** Подтверждённые `decision`/`design` источников с тегами, пересекающимися с подключёнными. */
export function generalRuleRecords(sources: readonly SharedSource[]): RuleRecord[] {
  const result: RuleRecord[] = [];
  for (const source of sources) {
    const wanted = new Set(source.tags ?? []);
    if (wanted.size === 0) continue;
    try {
      const root = sourceRoot(source.path);
      const workspace = readWorkspace(root);
      const { records } = analyze({ files: workspace.files, manifest: workspace.manifest });
      for (const record of records) {
        if (record.type !== 'decision' && record.type !== 'design') continue;
        if (record.status !== 'approved') continue;
        const tags = Array.isArray(record.data['tags']) ? (record.data['tags'] as unknown[]) : [];
        if (!tags.some((tag) => typeof tag === 'string' && wanted.has(tag))) continue;
        result.push({ id: record.id, label: workspace.manifest.project.id, body: record.body });
      }
    } catch {
      // Источник не открылся — экран «Практики» покажет это у самого источника; правил из него просто нет.
    }
  }
  return result;
}

/** Действующие правила проекта после сложения уровней. */
export function resolveProjectRules(root: string): RulesResolution {
  const normalized = normalizeRoot(root);
  const manifest = readManifest(normalized);
  const workspace = readWorkspace(normalized);
  const { records } = analyze({ files: workspace.files, manifest });
  const local: RuleRecord[] = records
    .filter((record) => (record.type === 'decision' || record.type === 'design') && record.status === 'approved')
    .map((record) => ({ id: record.id, body: record.body }));
  return resolveRules({
    manifest: manifest.architecture,
    general: generalRuleRecords(withBuiltin(manifest.sources?.shared ?? [])),
    local
  });
}
