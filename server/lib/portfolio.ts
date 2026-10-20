import type { ProjectIndex } from './types';

/**
 * Строка портфеля (T-0042): сводка одного проекта из его индекса. Чистая
 * функция — экран и проверка строятся на одном и том же, а файлов не читает.
 */
export interface PortfolioRow {
  id: string;
  name: string;
  tasks: { total: number; done: number; inProgress: number };
  phases: { total: number; done: number };
  errors: number;
  warnings: number;
  /** Самая поздняя дата `updated` среди записей; по ней видно, какой проект стоит. */
  lastActivity: string | null;
  /** Не читается: причина вместо цифр, остальные проекты портфеля при этом живы. */
  failure?: string;
}

export function portfolioRow(index: ProjectIndex): PortfolioRow {
  const tasks = index.records.filter((record) => record.type === 'task');
  const phases = index.records.filter((record) => record.type === 'phase');
  const dates = index.records.map((record) => record.updated).filter((date): date is string => !!date);
  return {
    id: index.project.id,
    name: index.project.name,
    tasks: {
      total: tasks.length,
      done: tasks.filter((record) => record.status === 'done').length,
      inProgress: tasks.filter((record) => record.status === 'in_progress').length
    },
    phases: { total: phases.length, done: phases.filter((record) => record.status === 'done').length },
    errors: index.issues.filter((issue) => issue.severity === 'error').length,
    warnings: index.issues.filter((issue) => issue.severity === 'warning').length,
    lastActivity: dates.length > 0 ? dates.reduce((a, b) => (a > b ? a : b)) : null
  };
}

export function failedRow(id: string, name: string, failure: string): PortfolioRow {
  return { id, name, tasks: { total: 0, done: 0, inProgress: 0 }, phases: { total: 0, done: 0 }, errors: 0, warnings: 0, lastActivity: null, failure };
}
