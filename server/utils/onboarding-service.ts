import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { analyze } from '../lib/analyze';
import { parseGlossary } from '../lib/glossary';
import { approvedMaps, parseMapRecord } from '../lib/maps';
import { EMPTY_STATE, checklist, readiness, type OnboardingState } from '../lib/onboarding';
import { normalizeRoot } from '../lib/paths';
import type { WorkRecord } from '../lib/types';
import { readWorkspace } from '../lib/workspace';

/**
 * Состояние подключения проекта (R-0075): всё считается из файлов проекта,
 * своей базы нет. Проект с беды чтения даёт пустое состояние, а не падение —
 * чек-лист нужен как раз тому, у кого ничего ещё нет.
 */

const OUT = new Set(['superseded', 'rejected', 'dropped']);
const pending = (status: string) => status === 'draft' || status === 'review';

/** Какие структуры карты лежат в записи: функциональная часть и три «карты устройства». */
function mapParts(record: WorkRecord): { functional: boolean; device: boolean; vision: boolean; capabilities: number } {
  const change = parseMapRecord(record.body).change;
  const functional = change.functional;
  return {
    functional: !!functional,
    device: !!(change.codemap || change.dataflow || change.userflow),
    vision: !!functional?.added?.vision,
    capabilities: functional?.added?.capabilities?.length ?? 0
  };
}

export function collectOnboarding(root: string): OnboardingState {
  const normalized = normalizeRoot(root);
  const state: OnboardingState = { ...EMPTY_STATE, sources: { ...EMPTY_STATE.sources } };
  try {
    const workspace = readWorkspace(normalized);
    const { records } = analyze({ files: workspace.files, manifest: workspace.manifest, reports: workspace.reports, codeFiles: workspace.codeFiles });
    const live = records.filter((record) => !OUT.has(record.status));

    state.sources = {
      code: workspace.manifest.sources?.code?.length ?? 0,
      docs: workspace.manifest.sources?.docs?.length ?? 0,
      client: workspace.manifest.sources?.client?.length ?? 0
    };

    // Вектор и возможности: подтверждённое — из сложенных карт, черновики — из тел черновых карт.
    const approved = approvedMaps(live);
    const approvedParts = approved.map(mapParts);
    state.vision = approvedParts.some((part) => part.vision) ? 'approved' : 'none';
    state.capabilities = approvedParts.reduce((sum, part) => sum + part.capabilities, 0);
    state.maps = approvedParts.filter((part) => part.device).length;
    for (const record of live.filter((item) => item.type === 'map' && pending(item.status))) {
      const part = mapParts(record);
      if (part.vision && state.vision === 'none') state.vision = 'draft';
      if (part.capabilities > 0) state.capabilitiesDraft += 1;
      if (part.device) state.mapsDraft += 1;
    }

    const requirements = live.filter((record) => record.type === 'requirement');
    const checks = live.filter((record) => record.type === 'verification');
    const verified = new Set<string>();
    for (const check of checks) for (const id of check.links.verifies ?? []) verified.add(id);
    for (const requirement of requirements) if ((requirement.links.verified_by ?? []).length > 0) verified.add(requirement.id);
    state.requirements = requirements.filter((record) => record.status === 'approved').length;
    state.requirementsDraft = requirements.filter((record) => pending(record.status)).length;
    state.requirementsChecked = requirements.filter((record) => record.status === 'approved' && verified.has(record.id)).length;

    const byType = (type: string) => ({
      done: live.filter((record) => record.type === type && record.status === 'approved').length,
      draft: live.filter((record) => record.type === type && pending(record.status)).length
    });
    ({ done: state.contracts, draft: state.contractsDraft } = byType('contract'));
    ({ done: state.references, draft: state.referencesDraft } = byType('reference'));

    // Проверки из тестов: автоматические, с командой запуска (в front matter или строкой «Запуск: `…`» в тексте).
    const fromTests = checks.filter((record) => ['unit', 'integration', 'e2e'].includes(String(record.data['kind'] ?? '')) && (typeof record.data['command'] === 'string' || /(?:Запуск|Команда)\s*:\s*`[^`]+`/.test(record.body)));
    state.testChecks = fromTests.filter((record) => record.status === 'approved').length;
    state.testChecksDraft = fromTests.filter((record) => pending(record.status)).length;

    // Глоссарий лежит в docs/development/glossary.md; пустой файл — не глоссарий.
    const glossary = join(normalized, 'docs', 'development', 'glossary.md');
    state.glossaryTerms = existsSync(glossary) ? parseGlossary(readFileSync(glossary, 'utf8')).length : 0;
  } catch { /* нет манифеста или не читается — пустое состояние */ }
  return state;
}

export function onboardingReport(root: string) {
  const state = collectOnboarding(root);
  const steps = checklist(state);
  return { state, steps, readiness: readiness(steps) };
}
