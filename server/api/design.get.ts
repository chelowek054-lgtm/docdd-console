import { defineEventHandler } from 'h3';

import { standardDesign, projectDesign } from '../utils/design-service';
import { loadIndex } from '../utils/index-service';
import { listProjects } from '../utils/projects';

/**
 * Глобальный экран «Дизайн» (docs/16-design-system.md): эталон консоли и то,
 * как с ним живут проекты. Один проект, не открывшийся, не роняет весь список —
 * у него своя строка с причиной.
 */
export default defineEventHandler(async () => {
  const standard = standardDesign();

  const projects = (await listProjects()).map((entry) => {
    try {
      const design = projectDesign(entry.root);
      const index = loadIndex(entry.root);
      const own = (prefix: string) => index.issues.filter((issue) => issue.code.startsWith(prefix)).length;
      return {
        id: entry.id,
        name: entry.name,
        connected: design.connected,
        hasDesign: !design.empty,
        tokenIssues: design.checks.length,
        driftIssues: own('design_theme_') + own('design_component_'),
        screenFindings: own('design_screen_'),
        error: null as string | null
      };
    } catch (error) {
      return {
        id: entry.id,
        name: entry.name,
        connected: false,
        hasDesign: false,
        tokenIssues: 0,
        driftIssues: 0,
        screenFindings: 0,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  });

  return {
    standard: standard
      ? { tokens: standard.tokens, checks: standard.checks, contrast: standard.contrast, sources: standard.sources }
      : null,
    projects
  };
});
