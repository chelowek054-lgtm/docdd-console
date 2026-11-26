import type { IndexRecord } from '../types';
import { hasRanks, rankOf, sortPhases, sortTasks } from '../work-order';

export function chatOverview(records: readonly IndexRecord[]) {
  const tasks = records.filter((record) => record.type === 'task');
  const phases = records.filter((record) => record.type === 'phase' && ['active', 'planned'].includes(record.status));
  const counts: Record<string, number> = Object.create(null);
  for (const task of tasks) counts[task.status] = (counts[task.status] ?? 0) + 1;
  const compact = ({ id, status, phase }: IndexRecord) => ({ id, status, phase });
  return {
    taskTotal: tasks.length,
    taskStatusCounts: counts,
    hasSavedPhaseRanks: hasRanks(phases),
    phases: sortPhases(phases, rankOf, 'importance').slice(0, 8).map(compact),
    ready: sortTasks(tasks.filter((task) => task.status === 'ready'), records, 'importance').slice(0, 8).map(compact)
  };
}
