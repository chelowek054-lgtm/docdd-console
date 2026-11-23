import type { CodemapPart } from '../../maps';
import type { WorkRecord } from '../../types';
import type { SystemDesign } from '../domain/model';

export type ComparisonCode = 'module_without_code' | 'code_outside_design' | 'undeclared_dependency' | 'contract_mismatch';
export interface Difference { code: ComparisonCode; location: string; detail: string }

export function compareDesign(design: SystemDesign, code: Required<CodemapPart>, contracts: readonly WorkRecord[]): Difference[] {
  const differences: Difference[] = [];
  const modules = new Map(code.modules.map((module) => [module.id, module]));
  const owners = new Map<string, string[]>();
  const interfaces = new Map(contracts.filter((item) => item.type === 'contract' && item.status === 'approved').map((item) => [item.id, item]));
  for (const node of design.nodes) {
    const missing = node.realized_by.filter((id) => !modules.has(id));
    if (!node.realized_by.length || missing.length) {
      differences.push({ code: 'module_without_code', location: node.id, detail: missing.join(', ') || node.title });
    }
    for (const module of node.realized_by) {
      const ids = owners.get(module) ?? [];
      ids.push(node.id);
      owners.set(module, ids);
    }
    if (!node.contract) continue;
    const contract = interfaces.get(node.contract);
    for (const field of ['inputs', 'outputs'] as const) {
      const expected = contract?.data[field];
      const actual = new Set(node[field] ?? []);
      if (!Array.isArray(expected) || expected.some((value) => typeof value !== 'string' || !actual.has(value)) || actual.size !== new Set(expected).size) {
        differences.push({ code: 'contract_mismatch', location: node.id, detail: node.contract + ' · ' + field });
      }
    }
  }
  for (const module of code.modules) {
    if (!owners.has(module.id)) differences.push({ code: 'code_outside_design', location: module.path ?? module.id, detail: module.id });
  }
  const declared = new Set(design.relations.map((edge) => JSON.stringify([edge.from, edge.to])));
  for (const edge of code.imports) {
    const sources = owners.get(edge.from);
    const targets = owners.get(edge.to);
    if (!sources || !targets) continue;
    if (!sources.some((from) => targets.some((to) => from === to || declared.has(JSON.stringify([from, to]))))) {
      differences.push({ code: 'undeclared_dependency', location: edge.evidence.path + ':' + edge.evidence.line, detail: edge.from + ' → ' + edge.to });
    }
  }
  return differences;
}
