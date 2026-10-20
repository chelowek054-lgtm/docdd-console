import { defineEventHandler } from 'h3';

import { failedRow, portfolioRow } from '../lib/portfolio';
import { loadIndex } from '../utils/index-service';
import { listProjects } from '../utils/projects';

/** Портфель (T-0042): сводка по каждому проекту списка; нечитаемый не рушит остальных. */
export default defineEventHandler(async () => {
  const rows = (await listProjects()).map((project) => {
    try {
      return portfolioRow(loadIndex(project.root));
    } catch (error) {
      return failedRow(project.id, project.name, error instanceof Error ? error.message : String(error));
    }
  });
  return { rows };
});
